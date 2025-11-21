import type { ManagedRecipe, ManagedField, FieldName, HistoryEntry } from '../../types/recipe/managed-recipe.js';
import type { RecipeJsonLd } from '../../types/recipe/recipe.js';
import { ContentHashService } from '../../services/content-hash-service.js';
import { FIELD_CONFIG, EDITABLE_FIELDS } from './field-config.js';

/**
 * Wrap a single field value in ManagedField envelope
 */
async function wrapField<T>(
	value: T,
	renderedValue: string,
	source: 'prepper' | 'llm' | 'user' = 'prepper',
	actor: string = 'system',
	summary: string = 'Initial ingestion from recipe webpage',
	llmModel?: string,
	promptVersion?: string
): Promise<ManagedField<T>> {
	const hash = await ContentHashService.hashContent(value);
	const timestamp = new Date().toISOString();

	const historyEntry: HistoryEntry = {
		timestamp,
		hash,
		source,
		actor,
		summary,
		...(llmModel && { llmModel }),
		...(promptVersion && { promptVersion }),
	};

	return {
		value,
		rendered: {
			type: 'markdown',
			value: renderedValue,
			version: '1.0.0',
		},
		currentHash: hash,
		baseHash: hash,
		history: [historyEntry],
	};
}

/**
 * Wrap a complete recipe - SMART: iterates over configured fields automatically
 */
export async function wrapRecipe(
	recipe: RecipeJsonLd,
	urlHash: string,
	originalUrl: string
): Promise<ManagedRecipe> {
	const timestamp = new Date().toISOString();

	// Start with metadata (non-wrapped fields)
	const managedRecipe: ManagedRecipe = {
		urlHash,
		originalUrl,
		createdAt: timestamp,
		lastModified: timestamp,
		schemaVersion: '1.0.0',
	};

	// Iterate over all configured fields - SMART!
	for (const fieldName of EDITABLE_FIELDS) {
		const value = recipe[fieldName as keyof RecipeJsonLd];

		if (value !== undefined && value !== null) {
			const renderer = FIELD_CONFIG[fieldName].render;
			const rendered = renderer(value);

			// @ts-expect-error: Dynamic field assignment
			managedRecipe[fieldName] = await wrapField(
				value,
				rendered,
				'prepper',
				'system',
				'Initial ingestion from recipe webpage'
			);
		}
	}

	return managedRecipe;
}

/**
 * Prune history to keep only last N entries
 */
export function pruneHistory<T>(
	field: ManagedField<T>,
	maxEntries = 20
): ManagedField<T> {
	if (field.history.length <= maxEntries) {
		return field;
	}

	return {
		...field,
		history: field.history.slice(-maxEntries),
	};
}

export { wrapField };
