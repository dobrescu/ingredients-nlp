import type { ManagedRecipe, ManagedField, HistoryEntry } from '../../types/recipe/managed-recipe.js';
import { EDITABLE_FIELDS } from './field-config.js';

/**
 * Validate ManagedRecipe structure - SMART: iterates over configured fields
 */
export function validateManagedRecipe(obj: unknown): asserts obj is ManagedRecipe {
	if (!obj || typeof obj !== 'object') {
		throw new Error('ManagedRecipe must be an object');
	}

	const recipe = obj as Record<string, unknown>;

	// Validate metadata
	const requiredMetadata = ['urlHash', 'originalUrl', 'createdAt', 'lastModified', 'schemaVersion'];
	for (const key of requiredMetadata) {
		if (typeof recipe[key] !== 'string') {
			throw new Error(`ManagedRecipe.${key} must be a string`);
		}
	}

	// Validate all configured fields (if present)
	for (const fieldName of EDITABLE_FIELDS) {
		const field = recipe[fieldName];
		if (field !== undefined && field !== null) {
			validateManagedField(field, fieldName);
		}
	}
}

/**
 * Validate a single ManagedField
 */
function validateManagedField(obj: unknown, fieldName: string): asserts obj is ManagedField<unknown> {
	if (!obj || typeof obj !== 'object') {
		throw new Error(`Field ${fieldName} must be a ManagedField object`);
	}

	const field = obj as Record<string, unknown>;

	// Check required properties
	if (!('value' in field)) {
		throw new Error(`Field ${fieldName}.value is required`);
	}
	if (typeof field.currentHash !== 'string') {
		throw new Error(`Field ${fieldName}.currentHash must be a string`);
	}
	if (typeof field.baseHash !== 'string') {
		throw new Error(`Field ${fieldName}.baseHash must be a string`);
	}
	if (!Array.isArray(field.history)) {
		throw new Error(`Field ${fieldName}.history must be an array`);
	}
	if (!field.rendered || typeof field.rendered !== 'object') {
		throw new Error(`Field ${fieldName}.rendered must be an object`);
	}

	const rendered = field.rendered as Record<string, unknown>;
	if (typeof rendered.type !== 'string' || typeof rendered.value !== 'string' || typeof rendered.version !== 'string') {
		throw new Error(`Field ${fieldName}.rendered must have type, value, and version as strings`);
	}

	// Validate history entries
	field.history.forEach((entry, i) => validateHistoryEntry(entry, `${fieldName}.history[${i}]`));
}

/**
 * Validate a history entry
 */
function validateHistoryEntry(obj: unknown, path: string): asserts obj is HistoryEntry {
	if (!obj || typeof obj !== 'object') {
		throw new Error(`${path} must be an object`);
	}

	const entry = obj as Record<string, unknown>;

	if (typeof entry.timestamp !== 'string') {
		throw new Error(`${path}.timestamp must be a string`);
	}
	if (typeof entry.hash !== 'string') {
		throw new Error(`${path}.hash must be a string`);
	}
	if (entry.source !== 'prepper' && entry.source !== 'llm' && entry.source !== 'user') {
		throw new Error(`${path}.source must be 'prepper', 'llm', or 'user'`);
	}
	if (typeof entry.summary !== 'string') {
		throw new Error(`${path}.summary must be a string`);
	}
	// Optional fields - validate if present
	if (entry.actor !== undefined && typeof entry.actor !== 'string') {
		throw new Error(`${path}.actor must be a string if provided`);
	}
	if (entry.llmModel !== undefined && typeof entry.llmModel !== 'string') {
		throw new Error(`${path}.llmModel must be a string if provided`);
	}
	if (entry.promptVersion !== undefined && typeof entry.promptVersion !== 'string') {
		throw new Error(`${path}.promptVersion must be a string if provided`);
	}
}
