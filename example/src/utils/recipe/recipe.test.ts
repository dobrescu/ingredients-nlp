import { describe, it, expect } from 'vitest';
import { wrapRecipe, unwrapRecipe, validateManagedRecipe, pruneHistory, normalizeUrl } from './index.js';
import type { RecipeJsonLd } from '../../types/recipe/recipe.js';
import type { ManagedField } from '../../types/recipe/managed-recipe.js';

describe('Recipe Utils', () => {
	describe('wrapRecipe & unwrapRecipe', () => {
		it('should wrap and unwrap a complete recipe', async () => {
			const original: RecipeJsonLd = {
				'@type': 'Recipe',
				name: 'Chocolate Cake',
				description: 'A delicious cake',
				recipeIngredient: ['flour', 'sugar', 'eggs'],
				recipeInstructions: [
					{ '@type': 'HowToStep', text: 'Mix ingredients' },
					{ '@type': 'HowToStep', text: 'Bake at 350°F' },
				],
				prepTime: 'PT15M',
			};

			const wrapped = await wrapRecipe(original, 'hash123', 'https://example.com/cake');
			const unwrapped = unwrapRecipe(wrapped);

			expect(unwrapped.name).toBe('Chocolate Cake');
			expect(unwrapped.description).toBe('A delicious cake');
			expect(unwrapped.recipeIngredient).toEqual(['flour', 'sugar', 'eggs']);
			expect(unwrapped.prepTime).toBe('PT15M');
		});

		it('should create proper ManagedField structure', async () => {
			const recipe: RecipeJsonLd = { '@type': 'Recipe', name: 'Test' };
			const wrapped = await wrapRecipe(recipe, 'hash', 'https://example.com');

			expect(wrapped.name?.value).toBe('Test');
			expect(wrapped.name?.currentHash).toBeTruthy();
			expect(wrapped.name?.baseHash).toBe(wrapped.name?.currentHash);
			expect(wrapped.name?.history).toHaveLength(1);
			expect(wrapped.name?.history[0].source).toBe('prepper');
		});

		it('should render fields as markdown', async () => {
			const recipe: RecipeJsonLd = {
				'@type': 'Recipe',
				recipeIngredient: ['flour', 'sugar'],
				recipeInstructions: [
					{ '@type': 'HowToStep', text: 'Step 1' },
					{ '@type': 'HowToStep', text: 'Step 2' },
				],
			};

			const wrapped = await wrapRecipe(recipe, 'hash', 'https://example.com');

			expect(wrapped.recipeIngredient?.rendered.value).toBe('- flour\n- sugar');
			expect(wrapped.recipeInstructions?.rendered.value).toContain('1. Step 1');
			expect(wrapped.recipeInstructions?.rendered.value).toContain('2. Step 2');
		});

		it('should handle HowToSection in instructions', async () => {
			const recipe: RecipeJsonLd = {
				'@type': 'Recipe',
				recipeInstructions: [
					{
						'@type': 'HowToSection',
						name: 'Preparation',
						steps: [{ '@type': 'HowToStep', text: 'Prep step' }],
					},
				],
			};

			const wrapped = await wrapRecipe(recipe, 'hash', 'https://example.com');
			expect(wrapped.recipeInstructions?.rendered.value).toContain('## Preparation');
		});
	});

	describe('validateManagedRecipe', () => {
		it('should validate correct structure', async () => {
			const recipe = await wrapRecipe({ '@type': 'Recipe', name: 'Test' }, 'hash', 'https://example.com');
			expect(() => validateManagedRecipe(recipe)).not.toThrow();
		});

		it('should reject invalid input', () => {
			expect(() => validateManagedRecipe(null)).toThrow('must be an object');
			expect(() => validateManagedRecipe({ urlHash: 123 })).toThrow('must be a string');
		});

		it('should reject invalid field structure', async () => {
			const recipe = await wrapRecipe({ '@type': 'Recipe', name: 'Test' }, 'hash', 'https://example.com');
			// @ts-expect-error: Testing invalid data
			recipe.name = 'invalid';
			expect(() => validateManagedRecipe(recipe)).toThrow('must be a ManagedField');
		});
	});

	describe('pruneHistory', () => {
		it('should keep all entries when under limit', () => {
			const field: ManagedField<string> = {
				value: 'test',
				rendered: { type: 'markdown', value: 'test', version: '1.0.0' },
				currentHash: 'hash1',
				baseHash: 'hash0',
				history: [
					{ timestamp: '2025-01-01T00:00:00Z', hash: 'hash0', source: 'prepper', summary: '1', actor: 'system' },
					{ timestamp: '2025-01-02T00:00:00Z', hash: 'hash1', source: 'llm', summary: '2', actor: 'system' },
				],
			};

			const pruned = pruneHistory(field, 20);
			expect(pruned.history.length).toBe(2);
		});

		it('should prune to last N entries', () => {
			const history = Array.from({ length: 10 }, (_, i) => ({
				timestamp: `2025-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
				hash: `hash${i}`,
				source: 'llm' as const,
				summary: `Entry ${i}`,
				actor: 'system',
			}));

			const field: ManagedField<string> = {
				value: 'test',
				rendered: { type: 'markdown', value: 'test', version: '1.0.0' },
				currentHash: 'hash9',
				baseHash: 'hash0',
				history,
			};

			const pruned = pruneHistory(field, 3);
			expect(pruned.history.length).toBe(3);
			expect(pruned.history[0].summary).toBe('Entry 7');
		});
	});

	describe('normalizeUrl', () => {
		it('should normalize URLs consistently', () => {
			const url1 = 'https://example.com/recipe?z=3&a=1';
			const url2 = 'https://example.com/recipe?a=1&z=3';
			expect(normalizeUrl(url1)).toBe(normalizeUrl(url2));
		});

		it('should remove trailing slash and fragments', () => {
			expect(normalizeUrl('https://example.com/recipe/')).toBe('https://example.com/recipe');
			expect(normalizeUrl('https://example.com/recipe#top')).toBe('https://example.com/recipe');
		});

		it('should remove default ports and normalize to https', () => {
			expect(normalizeUrl('https://example.com:443/recipe')).toBe('https://example.com/recipe');
			expect(normalizeUrl('http://example.com:80/recipe')).toBe('https://example.com/recipe');
		});

		it('should handle invalid URLs gracefully', () => {
			expect(normalizeUrl('not a url')).toBe('not a url');
		});
	});
});
