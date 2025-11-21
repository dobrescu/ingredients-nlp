import type { HeadlineGenerationInput, HeadlineGenerationResponse } from '../types.js';

export type { HeadlineGenerationInput, HeadlineGenerationResponse };

/**
 * JSON Schema for headline generation
 */
export const HeadlineSchema = {
	type: 'object',
	properties: {
		headline: {
			type: 'string',
			description: 'A catchy 5-12 word tagline for the recipe',
			minLength: 10,
			maxLength: 120
		}
	},
	required: ['headline'],
	additionalProperties: false
} as const;

/**
 * Validates headline response from AI
 */
export function validateHeadlineResponse(data: unknown): HeadlineGenerationResponse {
	if (!data || typeof data !== 'object') {
		throw new Error('Response must be an object');
	}

	const obj = data as Record<string, unknown>;

	if (typeof obj.headline !== 'string') {
		throw new Error('Response missing valid headline field');
	}

	const headline = obj.headline.trim();

	if (headline.length < 10) {
		throw new Error(`Headline too short: ${headline.length} chars (min 10)`);
	}

	if (headline.length > 120) {
		throw new Error(`Headline too long: ${headline.length} chars (max 120)`);
	}

	return { headline };
}
