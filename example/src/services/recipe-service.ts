/**
 * Recipe Service
 *
 * Business logic layer for recipe operations.
 * Orchestrates Repository + Mapper, handles merging, validation.
 */

import { RecipeRepository } from '../repositories/recipe-repository.js';
import { toStoredRecipe, toManagedRecipe, mergeUserAndBaseline } from '../mappers/recipe-mapper.js';
import type { ManagedRecipe, FieldName, ManagedField } from '../types/recipe/managed-recipe.js';

export class RecipeService {
	private readonly repository: RecipeRepository;

	constructor(repository?: RecipeRepository) {
		this.repository = repository || new RecipeRepository();
	}

	/**
	 * Get recipe for user (merges user customizations with baseline)
	 *
	 * @param firebaseUID User identifier (optional - if null, returns baseline only)
	 * @param urlHash Recipe identifier
	 * @returns Complete recipe with user customizations applied
	 */
	async getRecipe(firebaseUID: string | null, urlHash: string): Promise<ManagedRecipe | null> {
		// Get baseline (shared) recipe
		const sharedStored = await this.repository.getSharedRecipe(urlHash);
		if (!sharedStored) return null;

		const baseline = toManagedRecipe(sharedStored);

		// No user ID - return baseline as-is
		if (!firebaseUID) {
			return baseline;
		}

		// Get user customizations
		const userStored = await this.repository.getUserRecipe(firebaseUID, urlHash);

		// Merge user customizations with baseline
		return mergeUserAndBaseline(userStored, baseline);
	}

	/**
	 * Save recipe (shared or user)
	 *
	 * @param recipe Recipe to save
	 * @param type 'shared' (baseline) or 'user' (customizations)
	 * @param firebaseUID User identifier (required for type='user')
	 */
	async saveRecipe(
		recipe: ManagedRecipe,
		type: 'shared' | 'user',
		firebaseUID?: string
	): Promise<void> {
		const stored = toStoredRecipe(recipe, type, firebaseUID);

		if (type === 'shared') {
			await this.repository.putSharedRecipe(stored);
		} else {
			await this.repository.putUserRecipe(stored);
		}
	}

	/**
	 * Update a single field (shared or user)
	 *
	 * @param fieldName Field to update
	 * @param field New field value
	 * @param urlHash Recipe identifier
	 * @param firebaseUID User identifier (if null, updates shared)
	 */
	async updateField(
		fieldName: FieldName,
		field: ManagedField<unknown>,
		urlHash: string,
		firebaseUID?: string | null
	): Promise<void> {
		if (firebaseUID) {
			await this.repository.updateUserField(firebaseUID, urlHash, fieldName, field);
		} else {
			await this.repository.updateSharedField(urlHash, fieldName, field);
		}
	}

	/**
	 * Check if recipe exists (shared baseline)
	 */
	async recipeExists(urlHash: string): Promise<boolean> {
		const stored = await this.repository.getSharedRecipe(urlHash);
		return stored !== null;
	}
}
