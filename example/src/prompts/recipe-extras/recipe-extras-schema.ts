import type { RecipeExtrasInput, RecipeExtrasResponse } from '../types.js';

export type { RecipeExtrasInput, RecipeExtrasResponse };

/**
 * JSON Schema for recipe extras extraction
 */
export const RecipeExtrasSchema = {
	type: 'object',
	properties: {
		extras: {
			type: 'object',
			description: 'Additional recipe fields extracted from page fragments',
			additionalProperties: true
		}
	},
	required: ['extras'],
	additionalProperties: false
} as const;

/**
 * Validates recipe extras response from AI
 */
export function validateRecipeExtrasResponse(data: unknown): RecipeExtrasResponse {
	if (!data || typeof data !== 'object') {
		throw new Error('Response must be an object');
	}

	const obj = data as Record<string, unknown>;

	if (!obj.extras || typeof obj.extras !== 'object') {
		throw new Error('Response missing valid extras field');
	}

	// Validate extras is a plain object
	const extras = obj.extras as Record<string, unknown>;

	return { extras };
}
