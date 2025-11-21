import type { RecipeExtractionInput } from '../prompts/types.js';
import type { EnhancedRecipePage } from '../types/recipe/enhanced-recipe-page.js';

/**
 * Service for converting between different recipe data formats
 */
export class RecipeConverterService {
	/**
	 * Convert EnhancedRecipePage to RecipeExtractionInput format for AI processing
	 */
	static convertToExtractionInput(data: EnhancedRecipePage): RecipeExtractionInput {
		if (!data) {
			throw new Error('Recipe data is required for conversion');
		}

		// Extract HTML from raw fragment
		const html = this.extractStringFromFragment(data.fragments?.raw?.fragment) || '';

		// Extract name and description
		const name = this.extractStringFromFragment(data.fragments?.name?.fragment);
		const description = this.extractStringFromFragment(data.fragments?.description?.fragment);

		// Convert plugins to expected format using Map for efficiency
		const plugins: RecipeExtractionInput['plugins'] = {};

		if (data.plugins && Array.isArray(data.plugins)) {
			const pluginMap = new Map(
				data.plugins.map((p: { name: string; data: unknown }) => [p.name, p.data])
			);

			plugins.minify = pluginMap.get('minify') as Record<string, string> || undefined;
			plugins['ld-json'] = pluginMap.get('ld-json');
		}

		return { html, name, description, plugins };
	}

	/**
	 * Extract string from fragment (handles both string and object types)
	 */
	private static extractStringFromFragment(
		fragment: string | Record<string, unknown> | undefined
	): string | undefined {
		if (!fragment) return undefined;
		if (typeof fragment === 'string') return fragment;
		return JSON.stringify(fragment);
	}
}
