import type { ManagedRecipe, UnwrappedRecipe } from '../../types/recipe/managed-recipe.js';
import { EDITABLE_FIELDS } from './field-config.js';

/**
 * Unwrap ManagedRecipe to extract raw values - SMART: iterates automatically
 */
export function unwrapRecipe(managed: ManagedRecipe): UnwrappedRecipe {
	// Start with metadata
	const unwrapped: UnwrappedRecipe = {
		urlHash: managed.urlHash,
		originalUrl: managed.originalUrl,
		createdAt: managed.createdAt,
		lastModified: managed.lastModified,
		schemaVersion: managed.schemaVersion,
	};

	// Iterate over all configured fields - extract .value
	for (const fieldName of EDITABLE_FIELDS) {
		const field = managed[fieldName];
		if (field) {
			// @ts-expect-error: Dynamic field assignment
			unwrapped[fieldName] = field.value;
		}
	}

	return unwrapped;
}
