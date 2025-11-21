/**
 * Markdown Conversion Service
 *
 * Handles markdown conversion for text and list fields only.
 * Object fields (nutrition, author, etc.) are sent as JSON objects directly, NOT markdown.
 *
 * Conversions supported:
 * - HTML ↔ Markdown (inline formatting)
 * - List fields: Array ↔ Markdown list
 * - Instruction fields: HowToStep[] ↔ Numbered markdown list
 *
 * Works with field-config.ts renderers for consistency.
 */

import type { HowToStep, HowToSection } from '../types/recipe/recipe.js';

export class MarkdownConversionService {
	/**
	 * Convert HTML to Markdown (inline formatting only)
	 * Handles: bold, italic, links, line breaks
	 */
	static htmlToMarkdown(html: string): string {
		if (!html) return '';

		let markdown = html;

		// Convert bold tags
		markdown = markdown.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
		markdown = markdown.replace(/<b>(.*?)<\/b>/gi, '**$1**');

		// Convert italic tags
		markdown = markdown.replace(/<em>(.*?)<\/em>/gi, '*$1*');
		markdown = markdown.replace(/<i>(.*?)<\/i>/gi, '*$1*');

		// Convert links
		markdown = markdown.replace(/<a\s+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)');

		// Convert line breaks
		markdown = markdown.replace(/<br\s*\/?>/gi, '\n');

		// Strip remaining HTML tags
		markdown = markdown.replace(/<[^>]+>/g, '');

		// Decode HTML entities
		markdown = markdown
			.replace(/&amp;/g, '&')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&quot;/g, '"')
			.replace(/&#39;/g, "'")
			.replace(/&nbsp;/g, ' ');

		return markdown.trim();
	}

	/**
	 * Parse markdown list into string array
	 * Input: "- item1\n- item2\n- item3"
	 * Output: ["item1", "item2", "item3"]
	 */
	static markdownToList(markdown: string): string[] {
		if (!markdown || markdown.trim() === '') return [];

		return markdown
			.split('\n')
			.map((line) => line.trim())
			.filter((line) => line.startsWith('-') || line.startsWith('*'))
			.map((line) => line.replace(/^[-*]\s*/, '').trim())
			.filter((item) => item.length > 0);
	}

	/**
	 * Parse markdown numbered list into HowToStep array
	 * Supports optional sections with "## Section Name" headers
	 *
	 * Input:
	 * ```
	 * ## Preparation
	 * 1. Step one
	 * 2. Step two
	 * ## Cooking
	 * 1. Step three
	 * ```
	 */
	static markdownToInstructions(markdown: string): Array<HowToStep | HowToSection> {
		if (!markdown || markdown.trim() === '') return [];

		const lines = markdown.split('\n').map((line) => line.trim());
		const result: Array<HowToStep | HowToSection> = [];
		let currentSection: HowToSection | null = null;

		for (const line of lines) {
			if (line.length === 0) continue;

			// Section header (## Title)
			if (line.startsWith('## ')) {
				const sectionName = line.replace(/^##\s*/, '').trim();

				if (currentSection) {
					result.push(currentSection);
				}

				currentSection = {
					'@type': 'HowToSection',
					name: sectionName,
					steps: [],
				};
				continue;
			}

			// Numbered step (1. Text)
			const stepMatch = line.match(/^(\d+)\.\s*(.+)$/);
			if (stepMatch) {
				const [, , text] = stepMatch;
				const step: HowToStep = {
					'@type': 'HowToStep',
					text: text.trim(),
				};

				if (currentSection) {
					if (!currentSection.steps) {
						currentSection.steps = [];
					}
					currentSection.steps.push(step);
				} else {
					result.push(step);
				}
			}
		}

		// Add final section if exists
		if (currentSection) {
			result.push(currentSection);
		}

		return result;
	}

	/**
	 * Convert simple markdown formatting back to plain text
	 * Removes: bold (**text**), italic (*text*), links [text](url)
	 */
	static markdownToPlainText(markdown: string): string {
		if (!markdown) return '';

		let text = markdown;

		// Remove bold
		text = text.replace(/\*\*(.+?)\*\*/g, '$1');

		// Remove italic
		text = text.replace(/\*(.+?)\*/g, '$1');

		// Remove links, keep text
		text = text.replace(/\[(.+?)\]\(.+?\)/g, '$1');

		return text.trim();
	}

	/**
	 * Round-trip validation helper
	 * Checks if JSON-LD → Markdown → JSON-LD preserves structure
	 */
	static validateRoundTrip<T>(
		original: T,
		markdown: string,
		parser: (md: string) => T,
		comparator?: (a: T, b: T) => boolean
	): boolean {
		try {
			const parsed = parser(markdown);

			if (comparator) {
				return comparator(original, parsed);
			}

			// Default: JSON equality
			return JSON.stringify(original) === JSON.stringify(parsed);
		} catch {
			return false;
		}
	}
}
