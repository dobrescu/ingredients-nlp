import { describe, it, expect } from 'vitest';
import { MarkdownConversionService } from './markdown-conversion-service.js';
import { FIELD_CONFIG } from '../utils/recipe/field-config.js';

describe('MarkdownConversionService', () => {
	describe('htmlToMarkdown', () => {
		it('should convert bold and italic tags', () => {
			const html = 'This is <strong>bold</strong> and <em>italic</em> text';
			const result = MarkdownConversionService.htmlToMarkdown(html);
			expect(result).toBe('This is **bold** and *italic* text');
		});

		it('should convert links', () => {
			const html = 'Visit <a href="https://example.com">our site</a> for more';
			const result = MarkdownConversionService.htmlToMarkdown(html);
			expect(result).toBe('Visit [our site](https://example.com) for more');
		});

		it('should decode HTML entities', () => {
			const html = 'Tom &amp; Jerry&#39;s &quot;adventures&quot;';
			const result = MarkdownConversionService.htmlToMarkdown(html);
			expect(result).toBe('Tom & Jerry\'s "adventures"');
		});

		it('should strip remaining HTML tags', () => {
			const html = '<div><p>Text in <span>various</span> tags</p></div>';
			const result = MarkdownConversionService.htmlToMarkdown(html);
			expect(result).toBe('Text in various tags');
		});

		it('should handle empty input', () => {
			expect(MarkdownConversionService.htmlToMarkdown('')).toBe('');
			expect(MarkdownConversionService.htmlToMarkdown(null as any)).toBe('');
		});
	});

	describe('markdownToList', () => {
		it('should parse markdown list to array', () => {
			const markdown = '- flour\n- sugar\n- eggs';
			const result = MarkdownConversionService.markdownToList(markdown);
			expect(result).toEqual(['flour', 'sugar', 'eggs']);
		});

		it('should handle asterisk bullets', () => {
			const markdown = '* item 1\n* item 2';
			const result = MarkdownConversionService.markdownToList(markdown);
			expect(result).toEqual(['item 1', 'item 2']);
		});

		it('should ignore non-list lines', () => {
			const markdown = 'Title\n- item 1\nSome text\n- item 2';
			const result = MarkdownConversionService.markdownToList(markdown);
			expect(result).toEqual(['item 1', 'item 2']);
		});

		it('should handle empty input', () => {
			expect(MarkdownConversionService.markdownToList('')).toEqual([]);
			expect(MarkdownConversionService.markdownToList('   ')).toEqual([]);
		});
	});

	describe('markdownToInstructions', () => {
		it('should parse simple numbered list', () => {
			const markdown = '1. Preheat oven\n2. Mix ingredients\n3. Bake for 30 minutes';
			const result = MarkdownConversionService.markdownToInstructions(markdown);

			expect(result).toHaveLength(3);
			expect(result[0]).toEqual({ '@type': 'HowToStep', text: 'Preheat oven' });
			expect(result[1]).toEqual({ '@type': 'HowToStep', text: 'Mix ingredients' });
			expect(result[2]).toEqual({ '@type': 'HowToStep', text: 'Bake for 30 minutes' });
		});

		it('should parse instructions with sections', () => {
			const markdown = `## Preparation
1. Wash vegetables
2. Chop ingredients

## Cooking
1. Heat oil
2. Add vegetables`;

			const result = MarkdownConversionService.markdownToInstructions(markdown);

			expect(result).toHaveLength(2);
			expect(result[0]).toMatchObject({
				'@type': 'HowToSection',
				name: 'Preparation',
			});
			expect((result[0] as any).steps).toHaveLength(2);

			expect(result[1]).toMatchObject({
				'@type': 'HowToSection',
				name: 'Cooking',
			});
			expect((result[1] as any).steps).toHaveLength(2);
		});

		it('should handle empty input', () => {
			expect(MarkdownConversionService.markdownToInstructions('')).toEqual([]);
		});
	});

	describe('markdownToPlainText', () => {
		it('should remove markdown formatting', () => {
			const markdown = 'This is **bold** and *italic* with a [link](url)';
			const result = MarkdownConversionService.markdownToPlainText(markdown);
			expect(result).toBe('This is bold and italic with a link');
		});
	});

	describe('Round-trip conversions', () => {
		it('should preserve list structure through round-trip', () => {
			const original = ['flour', 'sugar', 'eggs'];

			// Render with field-config renderer
			const renderer = FIELD_CONFIG.recipeIngredient.render;
			const markdown = renderer(original);

			// Parse back
			const parsed = MarkdownConversionService.markdownToList(markdown);

			expect(parsed).toEqual(original);
		});

		it('should preserve instructions structure through round-trip', () => {
			const original = [
				{ '@type': 'HowToStep' as const, text: 'Mix ingredients' },
				{ '@type': 'HowToStep' as const, text: 'Bake at 350°F' },
			];

			// Render with field-config renderer
			const renderer = FIELD_CONFIG.recipeInstructions.render;
			const markdown = renderer(original);

			// Parse back
			const parsed = MarkdownConversionService.markdownToInstructions(markdown);

			expect(parsed).toEqual(original);
		});

		it('should preserve instructions with sections through round-trip', () => {
			const original = [
				{
					'@type': 'HowToSection' as const,
					name: 'Preparation',
					steps: [{ '@type': 'HowToStep' as const, text: 'Prep step' }],
				},
				{
					'@type': 'HowToSection' as const,
					name: 'Cooking',
					steps: [{ '@type': 'HowToStep' as const, text: 'Cook step' }],
				},
			];

			// Render with field-config renderer
			const renderer = FIELD_CONFIG.recipeInstructions.render;
			const markdown = renderer(original);

			// Parse back
			const parsed = MarkdownConversionService.markdownToInstructions(markdown);

			expect(parsed).toEqual(original);
		});
	});
});
