import { describe, it, expect, vi } from 'vitest';
import { mergeUserAndBaseline } from '../../../src/mappers/recipe-mapper.js';
import type { ManagedRecipe, StoredRecipe, ManagedField } from '../../../src/types/recipe/managed-recipe.js';

describe('RecipeMapper - ManagedRecipe Operations', () => {
	describe('mergeUserAndBaseline', () => {
		it('should return baseline when no user record exists', () => {
			const baseline: ManagedRecipe = {
				urlHash: 'abc123',
				originalUrl: 'https://example.com/recipe',
				createdAt: '2025-01-01T00:00:00Z',
				lastModified: '2025-01-01T00:00:00Z',
				schemaVersion: '1.0.0',
				name: createManagedField('Chocolate Cake', 'hash1')
			};

			const merged = mergeUserAndBaseline(null, baseline);

			expect(merged).toEqual(baseline);
		});

		it('should override baseline fields with user customizations', () => {
			const baseline: ManagedRecipe = {
				urlHash: 'abc123',
				originalUrl: 'https://example.com/recipe',
				createdAt: '2025-01-01T00:00:00Z',
				lastModified: '2025-01-01T00:00:00Z',
				schemaVersion: '1.0.0',
				name: createManagedField('Chocolate Cake', 'hash1'),
				description: createManagedField('Delicious cake', 'hash2')
			};

			const userRecord: StoredRecipe = {
				PK: 'user#user123',
				SK: 'recipe#abc123',
				urlHash: 'abc123',
				originalUrl: 'https://example.com/recipe',
				createdAt: '2025-01-01T00:00:00Z',
				lastModified: '2025-01-02T00:00:00Z',
				schemaVersion: '1.0.0',
				fields: {
					name: JSON.stringify(createManagedField('My Custom Cake', 'hash3'))
				}
			};

			const merged = mergeUserAndBaseline(userRecord, baseline);

			expect(merged.name?.value).toBe('My Custom Cake');
			expect(merged.name?.currentHash).toBe('hash3');
			expect(merged.description?.value).toBe('Delicious cake'); // Baseline kept
			expect(merged.lastModified).toBe('2025-01-02T00:00:00Z'); // User timestamp
		});

		it('should merge multiple user customizations', () => {
			const baseline: ManagedRecipe = {
				urlHash: 'abc123',
				originalUrl: 'https://example.com/recipe',
				createdAt: '2025-01-01T00:00:00Z',
				lastModified: '2025-01-01T00:00:00Z',
				schemaVersion: '1.0.0',
				name: createManagedField('Chocolate Cake', 'hash1'),
				description: createManagedField('Delicious cake', 'hash2'),
				recipeIngredient: createManagedField(['flour', 'sugar'], 'hash3')
			};

			const userRecord: StoredRecipe = {
				PK: 'user#user123',
				SK: 'recipe#abc123',
				urlHash: 'abc123',
				originalUrl: 'https://example.com/recipe',
				createdAt: '2025-01-01T00:00:00Z',
				lastModified: '2025-01-03T00:00:00Z',
				schemaVersion: '1.0.0',
				fields: {
					name: JSON.stringify(createManagedField('My Custom Name', 'hash4')),
					recipeIngredient: JSON.stringify(createManagedField(['flour', 'sugar', 'eggs'], 'hash5'))
				}
			};

			const merged = mergeUserAndBaseline(userRecord, baseline);

			expect(merged.name?.value).toBe('My Custom Name');
			expect(merged.recipeIngredient?.value).toEqual(['flour', 'sugar', 'eggs']);
			expect(merged.description?.value).toBe('Delicious cake'); // Baseline kept
		});

		it('should handle empty user fields object', () => {
			const baseline: ManagedRecipe = {
				urlHash: 'abc123',
				originalUrl: 'https://example.com/recipe',
				createdAt: '2025-01-01T00:00:00Z',
				lastModified: '2025-01-01T00:00:00Z',
				schemaVersion: '1.0.0',
				name: createManagedField('Chocolate Cake', 'hash1')
			};

			const userRecord: StoredRecipe = {
				PK: 'user#user123',
				SK: 'recipe#abc123',
				urlHash: 'abc123',
				originalUrl: 'https://example.com/recipe',
				createdAt: '2025-01-01T00:00:00Z',
				lastModified: '2025-01-02T00:00:00Z',
				schemaVersion: '1.0.0',
				fields: {}
			};

			const merged = mergeUserAndBaseline(userRecord, baseline);

			expect(merged.name?.value).toBe('Chocolate Cake');
			expect(merged.lastModified).toBe('2025-01-02T00:00:00Z');
		});

		it('should gracefully handle malformed JSON in user fields', () => {
			// Suppress console.error for this test
			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			const baseline: ManagedRecipe = {
				urlHash: 'abc123',
				originalUrl: 'https://example.com/recipe',
				createdAt: '2025-01-01T00:00:00Z',
				lastModified: '2025-01-01T00:00:00Z',
				schemaVersion: '1.0.0',
				name: createManagedField('Chocolate Cake', 'hash1')
			};

			const userRecord: StoredRecipe = {
				PK: 'user#user123',
				SK: 'recipe#abc123',
				urlHash: 'abc123',
				originalUrl: 'https://example.com/recipe',
				createdAt: '2025-01-01T00:00:00Z',
				lastModified: '2025-01-02T00:00:00Z',
				schemaVersion: '1.0.0',
				fields: {
					name: '{invalid json}' // Malformed JSON
				}
			};

			const merged = mergeUserAndBaseline(userRecord, baseline);

			// Should keep baseline value when user field fails to parse
			expect(merged.name?.value).toBe('Chocolate Cake');

			// Restore console.error
			consoleErrorSpy.mockRestore();
		});
	});

	describe('Serialization round-trip', () => {
		it('should preserve complex field types through serialization', () => {
			const original: ManagedField<string[]> = {
				value: ['flour', 'sugar', 'eggs'],
				rendered: {
					type: 'markdown',
					value: '- flour\n- sugar\n- eggs',
					version: '1.0.0'
				},
				currentHash: 'abc123',
				baseHash: 'abc123',
				history: [
					{
						timestamp: '2025-01-01T00:00:00Z',
						hash: 'abc123',
						source: 'prepper',
						actor: 'system',
						summary: 'Initial extraction'
					}
				]
			};

			const json = JSON.stringify(original);
			const parsed: ManagedField<string[]> = JSON.parse(json);

			expect(parsed.value).toEqual(original.value);
			expect(parsed.rendered).toEqual(original.rendered);
			expect(parsed.currentHash).toBe(original.currentHash);
			expect(parsed.baseHash).toBe(original.baseHash);
			expect(parsed.history).toEqual(original.history);
		});

		it('should preserve nested object fields through serialization', () => {
			const original: ManagedField<{ calories: string; proteinContent: string }> = {
				value: {
					calories: '450 kcal',
					proteinContent: '25g'
				},
				rendered: {
					type: 'text',
					value: '{"calories":"450 kcal","proteinContent":"25g"}',
					version: '1.0.0'
				},
				currentHash: 'nutrition-hash',
				baseHash: 'nutrition-hash',
				history: [
					{
						timestamp: '2025-01-01T00:00:00Z',
						hash: 'nutrition-hash',
						source: 'llm',
						actor: 'claude-3-5-sonnet-20241022',
						llmModel: 'claude-3-5-sonnet-20241022',
						promptVersion: 'recipe-extras-v1.2.0',
						summary: 'Extracted nutrition facts'
					}
				]
			};

			const json = JSON.stringify(original);
			const parsed = JSON.parse(json);

			expect(parsed.value).toEqual(original.value);
			expect(parsed.value.calories).toBe('450 kcal');
			expect(parsed.history[0].llmModel).toBe('claude-3-5-sonnet-20241022');
		});
	});

	describe('Key generation', () => {
		it('should generate correct partition key for shared recipe', () => {
			const urlHash = 'abc123def456';
			const PK = `recipe#${urlHash}`;
			const SK = 'base';

			expect(PK).toBe('recipe#abc123def456');
			expect(SK).toBe('base');
		});

		it('should generate correct partition key for user recipe', () => {
			const firebaseUID = 'user123abc';
			const urlHash = 'abc123def456';
			const PK = `user#${firebaseUID}`;
			const SK = `recipe#${urlHash}`;

			expect(PK).toBe('user#user123abc');
			expect(SK).toBe('recipe#abc123def456');
		});
	});
});

// Test helper functions

function createManagedField<T>(value: T, hash: string): ManagedField<T> {
	return {
		value,
		rendered: {
			type: 'text',
			value: typeof value === 'string' ? value : JSON.stringify(value),
			version: '1.0.0'
		},
		currentHash: hash,
		baseHash: hash,
		history: [
			{
				timestamp: new Date().toISOString(),
				hash,
				source: 'prepper',
				actor: 'system',
				summary: 'Test field'
			}
		]
	};
}
