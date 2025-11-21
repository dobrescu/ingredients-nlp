/**
 * Recipe Mapper
 *
 * Handles serialization between ManagedRecipe (domain model) and StoredRecipe (database model).
 * Pure functions, no side effects, easily testable.
 */

import { EDITABLE_FIELDS } from '../utils/recipe/field-config.js';
import type { ManagedRecipe, StoredRecipe, FieldName } from '../types/recipe/managed-recipe.js';
import { logger } from '../utils/logger/logger.js';

/**
 * Convert ManagedRecipe to StoredRecipe for DynamoDB storage
 *
 * @param recipe Domain model (in-memory representation)
 * @param type Storage type: 'shared' (baseline) or 'user' (customizations)
 * @param firebaseUID User identifier (required for type='user')
 * @returns Database model ready for storage
 */
export const toStoredRecipe = (
	recipe: ManagedRecipe,
	type: 'shared' | 'user',
	firebaseUID?: string
): StoredRecipe => {
	if (type === 'user' && !firebaseUID?.trim()) {
		throw new Error('firebaseUID is required for user recipes');
	}

	const fields: Record<string, string> = {};

	// Serialize each ManagedField to JSON string
	for (const fieldName of EDITABLE_FIELDS) {
		const field = recipe[fieldName];
		if (field !== undefined) {
			fields[fieldName] = JSON.stringify(field);
		}
	}

	return {
		PK: type === 'shared' ? `recipe#${recipe.urlHash}` : `user#${firebaseUID}`,
		SK: type === 'shared' ? 'base' : `recipe#${recipe.urlHash}`,
		urlHash: recipe.urlHash,
		originalUrl: recipe.originalUrl,
		createdAt: recipe.createdAt,
		lastModified: recipe.lastModified,
		schemaVersion: recipe.schemaVersion,
		fields
	};
};

/**
 * Convert StoredRecipe from DynamoDB to ManagedRecipe domain model
 *
 * @param stored Database model from DynamoDB
 * @returns Domain model for application use
 */
export const toManagedRecipe = (stored: StoredRecipe): ManagedRecipe => {
	const recipe: ManagedRecipe = {
		urlHash: stored.urlHash,
		originalUrl: stored.originalUrl,
		createdAt: stored.createdAt,
		lastModified: stored.lastModified,
		schemaVersion: stored.schemaVersion
	};

	// Deserialize each field from JSON string
	for (const [fieldName, fieldJson] of Object.entries(stored.fields)) {
		try {
			(recipe as any)[fieldName] = JSON.parse(fieldJson);
		} catch (error) {
			// Log but don't throw - allow partial data recovery
			logger.error('Failed to parse field', { fieldName, error });
		}
	}

	return recipe;
};

/**
 * Merge user customizations with baseline recipe
 * User fields override baseline fields when present
 *
 * @param userRecord User's stored recipe (may contain only customized fields)
 * @param baselineRecipe Complete baseline recipe from shared cache
 * @returns Complete recipe with user customizations applied
 */
export const mergeUserAndBaseline = (
	userRecord: StoredRecipe | null,
	baselineRecipe: ManagedRecipe
): ManagedRecipe => {
	// No user customizations - return baseline as-is
	if (!userRecord) {
		return baselineRecipe;
	}

	// Start with baseline, apply user overrides
	const merged: ManagedRecipe = { ...baselineRecipe };

	for (const [fieldName, fieldJson] of Object.entries(userRecord.fields)) {
		try {
			(merged as any)[fieldName] = JSON.parse(fieldJson);
		} catch (error) {
			logger.error('Failed to parse user field', { fieldName, error });
			// Keep baseline value on parse error
		}
	}

	// Update metadata to reflect user customizations
	merged.lastModified = userRecord.lastModified;

	return merged;
};
