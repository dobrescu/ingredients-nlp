/**
 * TypeScript types for recipe extraction
 */
export interface RecipeIngredient {
	quantity: string | null;
	unit: string | null;
	name: string;
}

export interface RecipeIngredientSection {
	section: string | null;
	ingredients: RecipeIngredient[];
}

export interface RecipeDirectionSection {
	section: string | null;
	steps: string[];
}

export interface RecipeNutrition {
	'Serving Size'?: string;
	[key: string]: string | undefined;
}

export interface RecipeSchema {
	name: string;
	description: string;
	headline: string;
	prepTime: string;
	totalTime: string;
	servesNumber: number;
	servesType: 'serving' | 'slice' | 'piece' | 'cup' | 'bowl' | 'plate' | 'glass';
	ingredients: RecipeIngredientSection[];
	directions: RecipeDirectionSection[];
	nutrition: RecipeNutrition | null;
	storage: string[] | null;
	tips: string[];
	allergens: string[];
}

/**
 * JSON Schema for recipe extraction function calling
 */
export const recipeFunction = {
	name: 'extract_recipe',
	description: 'Extracts structured recipe information from cleaned HTML',
	parameters: {
		type: 'object',
		properties: {
			name: { type: 'string' },
			description: { type: 'string' },
			headline: { type: ['string'] },
			prepTime: { type: 'string' },
			totalTime: { type: 'string' },
			servesNumber: { type: 'number' },
			servesType: {
				type: 'string',
				enum: ['serving', 'slice', 'piece', 'cup', 'bowl', 'plate', 'glass']
			},
			ingredients: {
				type: 'array',
				items: {
					type: 'object',
					properties: {
						section: { type: ['string', 'null'] },
						ingredients: {
							type: 'array',
							items: {
								type: 'object',
								properties: {
									quantity: { type: ['string', 'null'] },
									unit: { type: ['string', 'null'] },
									name: { type: 'string' }
								},
								required: ['quantity', 'unit', 'name']
							}
						}
					},
					required: ['section', 'ingredients']
				}
			},
			directions: {
				type: 'array',
				items: {
					type: 'object',
					properties: {
						section: { type: ['string', 'null'] },
						steps: {
							type: 'array',
							items: { type: 'string' }
						}
					},
					required: ['section', 'steps']
				}
			},
			nutrition: {
				type: ['object', 'null'],
				properties: {
					'Serving Size': {
						type: 'string',
						pattern: '^[0-9]+(\\.[0-9]+)?\\s?[a-zA-Zµ%\\w\\s]+$'
					}
				},
				patternProperties: {
					// All other keys must be number + unit, no space
					'^(?!Serving Size$).*': {
						type: 'string',
						pattern: '^[0-9]+(\\.[0-9]+)?[a-zA-Zµ%]+$'
					}
				},
				additionalProperties: false
			},

			storage: {
				type: ['array', 'null'],
				items: { type: 'string' }
			},
			tips: {
				type: 'array',
				items: { type: 'string' }
			},
			allergens: {
				type: 'array',
				items: { type: 'string' }
			}
		},
		required: [
			'name',
			'description',
			'prepTime',
			'totalTime',
			'servesNumber',
			'servesType',
			'ingredients',
			'directions',
			'nutrition',
			'storage',
			'tips',
			'allergens'
		]
	}
};

/**
 * Runtime validation for recipe extraction response
 */
export function validateRecipeResponse(response: unknown): RecipeSchema {
	if (!response || typeof response !== 'object') {
		throw new Error('Recipe response must be an object');
	}

	const recipe = response as Partial<RecipeSchema>;

	if (typeof recipe.name !== 'string' || !recipe.name.trim()) {
		throw new Error('Recipe must have a valid name');
	}

	if (typeof recipe.description !== 'string') {
		throw new Error('Recipe must have a description');
	}

	if (typeof recipe.headline !== 'string') {
		throw new Error('Recipe must have a headline');
	}

	if (!Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) {
		throw new Error('Recipe must have at least one ingredient section');
	}

	if (!Array.isArray(recipe.directions) || recipe.directions.length === 0) {
		throw new Error('Recipe must have at least one direction section');
	}

	return recipe as RecipeSchema;
}
