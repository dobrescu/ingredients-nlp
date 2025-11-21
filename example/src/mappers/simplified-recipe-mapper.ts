/**
 * Simplified Recipe Mapper
 *
 * Converts between ManagedRecipe (internal) and SimplifiedRecipe (API/Kassi).
 * SimplifiedRecipe uses flat markdown strings for lists/instructions, JSON objects for complex fields.
 */

import type {
	ManagedRecipe,
	SimplifiedRecipe,
	FieldName,
	ManagedField,
	HistoryEntry,
} from '../types/recipe/managed-recipe.js';
import { EDITABLE_FIELDS, getFieldType } from '../utils/recipe/field-config.js';
import { MarkdownConversionService } from '../services/markdown-conversion-service.js';
import { ContentHashService } from '../services/content-hash-service.js';

/**
 * Convert ManagedRecipe to SimplifiedRecipe (for API responses to Kassi)
 *
 * Extracts rendered markdown strings from ManagedField wrappers.
 * Unwraps image, video, and author for cleaner frontend integration.
 */
export function toSimplifiedRecipe(recipe: ManagedRecipe): SimplifiedRecipe {
	const simplified: SimplifiedRecipe = {
		// Include originalUrl from recipe metadata
		originalUrl: recipe.originalUrl,
	};

	for (const fieldName of EDITABLE_FIELDS) {
		const managedField = recipe[fieldName] as ManagedField<unknown> | undefined;
		if (!managedField) continue;

		const fieldType = getFieldType(fieldName);

		// For text and list fields, use rendered markdown
		if (fieldType === 'text' || fieldType === 'list') {
			simplified[fieldName as keyof SimplifiedRecipe] = managedField.rendered.value as any;
		}
		// Special handling for object fields
		else if (fieldType === 'object') {
			// Unwrap image (remove @type and @context)
			if (fieldName === 'image' && managedField.value) {
				const imageValue = managedField.value as any;
				simplified.image = {
					primaryContentUrl: imageValue.primaryContentUrl,
					additionalContentUrl: imageValue.additionalContentUrl,
				};
			}
			// Unwrap video (remove @type and @context)
			else if (fieldName === 'video' && managedField.value) {
				const videoValue = managedField.value as any;
				simplified.video = {
					name: videoValue.name,
					description: videoValue.description,
					contentUrl: videoValue.contentUrl,
					thumbnailUrl: videoValue.thumbnailUrl,
				};
			}
			// Unwrap author (extract just the name string)
			else if (fieldName === 'author' && managedField.value) {
				const authorValue = managedField.value as any;
				simplified.author = authorValue.name || '';
			}
			// Skip aggregateRating (not sent to Kassi for now)
			else if (fieldName === 'aggregateRating') {
				// Don't include aggregateRating in simplified recipe
				continue;
			}
			// For other object fields (nutrition), use JSON-LD value directly
			else {
				simplified[fieldName as keyof SimplifiedRecipe] = managedField.value as any;
			}
		}
	}

	return simplified;
}

/**
 * Convert SimplifiedRecipe to partial ManagedRecipe (for API requests from Kassi)
 *
 * Parses markdown strings back to JSON-LD, wraps in ManagedField.
 * Rewraps unwrapped fields (image, video, author) back to their full objects.
 * Only includes fields present in the simplified recipe.
 *
 * @param simplified SimplifiedRecipe from API request
 * @param source Source of the update ('user' or 'llm')
 * @param actor Actor identifier (firebaseUID or 'system')
 * @param summary Summary of the change
 * @returns Partial ManagedRecipe with wrapped fields
 */
export async function fromSimplifiedRecipe(
	simplified: SimplifiedRecipe,
	source: 'user' | 'llm',
	actor: string,
	summary: string
): Promise<Partial<ManagedRecipe>> {
	const partial: Partial<ManagedRecipe> = {};

	for (const fieldName of EDITABLE_FIELDS) {
		const simplifiedValue = simplified[fieldName as keyof SimplifiedRecipe];
		if (simplifiedValue === undefined) continue;

		const fieldType = getFieldType(fieldName);

		let jsonLdValue: unknown;
		let renderedValue: string;

		// Handle text fields (simple strings)
		if (fieldType === 'text') {
			jsonLdValue = simplifiedValue as string;
			renderedValue = simplifiedValue as string;
		}
		// Handle list fields (markdown → array conversion)
		else if (fieldType === 'list') {
			const markdown = simplifiedValue as string;

			// Special handling for recipeInstructions (structured)
			if (fieldName === 'recipeInstructions') {
				jsonLdValue = MarkdownConversionService.markdownToInstructions(markdown);
			}
			// recipeIngredient and other lists
			else {
				jsonLdValue = MarkdownConversionService.markdownToList(markdown);
			}

			renderedValue = markdown;
		}
		// Handle object fields
		else if (fieldType === 'object') {
			// Rewrap image (add @type and @context)
			if (fieldName === 'image' && simplifiedValue) {
				const imageData = simplifiedValue as SimplifiedRecipe['image'];
				jsonLdValue = {
					'@type': 'ImageObject',
					'@context': 'https://schema.org',
					primaryContentUrl: imageData?.primaryContentUrl,
					additionalContentUrl: imageData?.additionalContentUrl,
				};
				renderedValue = JSON.stringify(jsonLdValue, null, 2);
			}
			// Rewrap video (add @type and @context)
			else if (fieldName === 'video' && simplifiedValue) {
				const videoData = simplifiedValue as SimplifiedRecipe['video'];
				jsonLdValue = {
					'@type': 'VideoObject',
					'@context': 'https://schema.org',
					name: videoData?.name,
					description: videoData?.description,
					contentUrl: videoData?.contentUrl,
					thumbnailUrl: videoData?.thumbnailUrl,
				};
				renderedValue = JSON.stringify(jsonLdValue, null, 2);
			}
			// Rewrap author (reconstruct AuthorInformation object)
			else if (fieldName === 'author' && simplifiedValue) {
				const authorName = simplifiedValue as string;
				jsonLdValue = {
					'@type': 'Person',
					name: authorName,
				};
				renderedValue = JSON.stringify(jsonLdValue, null, 2);
			}
			// For other object fields (nutrition), use value directly
			else {
				jsonLdValue = simplifiedValue;
				renderedValue = JSON.stringify(simplifiedValue, null, 2);
			}
		} else {
			// Unknown field type - skip
			continue;
		}

		// Compute hash
		const hash = await ContentHashService.hashContent(jsonLdValue);

		// Create history entry
		const historyEntry: HistoryEntry = {
			timestamp: new Date().toISOString(),
			hash,
			source,
			actor,
			summary,
		};

		// Create ManagedField
		const managedField: ManagedField<unknown> = {
			value: jsonLdValue,
			rendered: {
				type: fieldType === 'object' ? 'text' : 'markdown',
				value: renderedValue,
				version: '1.0.0',
			},
			currentHash: hash,
			baseHash: hash, // For new fields from user, baseHash = currentHash
			history: [historyEntry],
		};

		partial[fieldName as keyof ManagedRecipe] = managedField as any;
	}

	return partial;
}

/**
 * Merge SimplifiedRecipe changes into existing ManagedRecipe
 *
 * Updates only the fields present in the simplified recipe.
 * Creates new history entries for changed fields.
 * Rewraps unwrapped fields (image, video, author) back to their full objects.
 *
 * @param current Current ManagedRecipe
 * @param simplified SimplifiedRecipe with updates
 * @param actor Actor identifier (firebaseUID)
 * @returns Updated ManagedRecipe and list of changed field names
 */
export async function mergeSimplifiedRecipe(
	current: ManagedRecipe,
	simplified: SimplifiedRecipe,
	actor: string
): Promise<{ updated: ManagedRecipe; changedFields: FieldName[] }> {
	const updated: ManagedRecipe = { ...current };
	const changedFields: FieldName[] = [];

	for (const fieldName of EDITABLE_FIELDS) {
		const simplifiedValue = simplified[fieldName as keyof SimplifiedRecipe];
		if (simplifiedValue === undefined) continue;

		const currentField = current[fieldName] as ManagedField<unknown> | undefined;
		const fieldType = getFieldType(fieldName);

		let jsonLdValue: unknown;
		let renderedValue: string;

		// Parse SimplifiedRecipe value to JSON-LD
		if (fieldType === 'text') {
			jsonLdValue = simplifiedValue as string;
			renderedValue = simplifiedValue as string;
		} else if (fieldType === 'list') {
			const markdown = simplifiedValue as string;

			if (fieldName === 'recipeInstructions') {
				jsonLdValue = MarkdownConversionService.markdownToInstructions(markdown);
			} else {
				jsonLdValue = MarkdownConversionService.markdownToList(markdown);
			}

			renderedValue = markdown;
		} else if (fieldType === 'object') {
			// Rewrap image (add @type and @context)
			if (fieldName === 'image' && simplifiedValue) {
				const imageData = simplifiedValue as SimplifiedRecipe['image'];
				jsonLdValue = {
					'@type': 'ImageObject',
					'@context': 'https://schema.org',
					primaryContentUrl: imageData?.primaryContentUrl,
					additionalContentUrl: imageData?.additionalContentUrl,
				};
				renderedValue = JSON.stringify(jsonLdValue, null, 2);
			}
			// Rewrap video (add @type and @context)
			else if (fieldName === 'video' && simplifiedValue) {
				const videoData = simplifiedValue as SimplifiedRecipe['video'];
				jsonLdValue = {
					'@type': 'VideoObject',
					'@context': 'https://schema.org',
					name: videoData?.name,
					description: videoData?.description,
					contentUrl: videoData?.contentUrl,
					thumbnailUrl: videoData?.thumbnailUrl,
				};
				renderedValue = JSON.stringify(jsonLdValue, null, 2);
			}
			// Rewrap author (reconstruct AuthorInformation object)
			else if (fieldName === 'author' && simplifiedValue) {
				const authorName = simplifiedValue as string;
				jsonLdValue = {
					'@type': 'Person',
					name: authorName,
				};
				renderedValue = JSON.stringify(jsonLdValue, null, 2);
			}
			// For other object fields (nutrition), use value directly
			else {
				jsonLdValue = simplifiedValue;
				renderedValue = JSON.stringify(simplifiedValue, null, 2);
			}
		} else {
			continue;
		}

		// Compute hash
		const newHash = await ContentHashService.hashContent(jsonLdValue);

		// Check if field actually changed
		if (currentField && currentField.currentHash === newHash) {
			continue; // No change, skip
		}

		changedFields.push(fieldName);

		// Create updated ManagedField
		const historyEntry: HistoryEntry = {
			timestamp: new Date().toISOString(),
			hash: newHash,
			source: 'user',
			actor,
			summary: 'User edit via Kassi',
		};

		const newField: ManagedField<unknown> = {
			value: jsonLdValue,
			rendered: {
				type: fieldType === 'object' ? 'text' : 'markdown',
				value: renderedValue,
				version: '1.0.0',
			},
			currentHash: newHash,
			baseHash: currentField?.baseHash || newHash, // Preserve baseHash or use new hash
			history: [...(currentField?.history || []), historyEntry].slice(-20), // Keep last 20 entries
		};

		updated[fieldName as keyof ManagedRecipe] = newField as any;
	}

	return { updated, changedFields };
}
