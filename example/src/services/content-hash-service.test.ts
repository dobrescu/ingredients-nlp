import { describe, it, expect } from 'vitest';
import { ContentHashService } from './content-hash-service.js';

describe('ContentHashService', () => {
	describe('hashContent', () => {
		it('should produce deterministic hashes for same input', async () => {
			const input = { name: 'Chocolate Cake', servings: 8 };
			const hash1 = await ContentHashService.hashContent(input);
			const hash2 = await ContentHashService.hashContent(input);

			expect(hash1).toBe(hash2);
		});

		it('should produce same hash regardless of object key order', async () => {
			const input1 = { name: 'Chocolate Cake', servings: 8, time: '45min' };
			const input2 = { time: '45min', servings: 8, name: 'Chocolate Cake' };

			const hash1 = await ContentHashService.hashContent(input1);
			const hash2 = await ContentHashService.hashContent(input2);

			expect(hash1).toBe(hash2);
		});

		it('should produce different hashes for different inputs', async () => {
			const input1 = { name: 'Chocolate Cake' };
			const input2 = { name: 'Vanilla Cake' };

			const hash1 = await ContentHashService.hashContent(input1);
			const hash2 = await ContentHashService.hashContent(input2);

			expect(hash1).not.toBe(hash2);
		});

		it('should produce 64-character hex string (SHA-256)', async () => {
			const input = { name: 'Test Recipe' };
			const hash = await ContentHashService.hashContent(input);

			expect(hash).toMatch(/^[a-f0-9]{64}$/);
			expect(hash.length).toBe(64);
		});

		it('should handle null values', async () => {
			const input1 = { nutrition: null };
			const input2 = { nutrition: null };

			const hash1 = await ContentHashService.hashContent(input1);
			const hash2 = await ContentHashService.hashContent(input2);

			expect(hash1).toBe(hash2);
		});

		it('should handle arrays', async () => {
			const input1 = { ingredients: ['flour', 'sugar', 'eggs'] };
			const input2 = { ingredients: ['flour', 'sugar', 'eggs'] };

			const hash1 = await ContentHashService.hashContent(input1);
			const hash2 = await ContentHashService.hashContent(input2);

			expect(hash1).toBe(hash2);
		});

		it('should produce different hashes for different array order', async () => {
			const input1 = { ingredients: ['flour', 'sugar', 'eggs'] };
			const input2 = { ingredients: ['eggs', 'flour', 'sugar'] };

			const hash1 = await ContentHashService.hashContent(input1);
			const hash2 = await ContentHashService.hashContent(input2);

			expect(hash1).not.toBe(hash2);
		});

		it('should handle nested objects', async () => {
			const input = {
				recipe: {
					name: 'Cake',
					nutrition: {
						calories: 450,
						protein: '10g',
					},
				},
			};

			const hash1 = await ContentHashService.hashContent(input);
			const hash2 = await ContentHashService.hashContent(input);

			expect(hash1).toBe(hash2);
		});

		it('should handle deeply nested structures with key reordering', async () => {
			const input1 = {
				recipe: {
					name: 'Cake',
					nutrition: { calories: 450, protein: '10g' },
				},
			};
			const input2 = {
				recipe: {
					nutrition: { protein: '10g', calories: 450 },
					name: 'Cake',
				},
			};

			const hash1 = await ContentHashService.hashContent(input1);
			const hash2 = await ContentHashService.hashContent(input2);

			expect(hash1).toBe(hash2);
		});

		it('should handle empty objects', async () => {
			const input1 = {};
			const input2 = {};

			const hash1 = await ContentHashService.hashContent(input1);
			const hash2 = await ContentHashService.hashContent(input2);

			expect(hash1).toBe(hash2);
		});

		it('should handle empty arrays', async () => {
			const input1 = { ingredients: [] };
			const input2 = { ingredients: [] };

			const hash1 = await ContentHashService.hashContent(input1);
			const hash2 = await ContentHashService.hashContent(input2);

			expect(hash1).toBe(hash2);
		});

		it('should handle primitive values', async () => {
			const stringHash = await ContentHashService.hashContent('test');
			const numberHash = await ContentHashService.hashContent(123);
			const boolHash = await ContentHashService.hashContent(true);

			expect(stringHash).toMatch(/^[a-f0-9]{64}$/);
			expect(numberHash).toMatch(/^[a-f0-9]{64}$/);
			expect(boolHash).toMatch(/^[a-f0-9]{64}$/);

			expect(stringHash).not.toBe(numberHash);
			expect(numberHash).not.toBe(boolHash);
		});

		it('should produce different hashes for similar but different structures', async () => {
			const input1 = { ingredients: ['2 cups flour'] };
			const input2 = { ingredients: ['2cups flour'] }; // Missing space

			const hash1 = await ContentHashService.hashContent(input1);
			const hash2 = await ContentHashService.hashContent(input2);

			expect(hash1).not.toBe(hash2);
		});

		it('should handle whitespace differences in strings', async () => {
			const input1 = { name: 'Chocolate Cake' };
			const input2 = { name: 'Chocolate  Cake' }; // Two spaces

			const hash1 = await ContentHashService.hashContent(input1);
			const hash2 = await ContentHashService.hashContent(input2);

			expect(hash1).not.toBe(hash2);
		});
	});

	describe('compareHashes', () => {
		it('should return true for identical hashes', () => {
			const hash1 = 'abc123def456';
			const hash2 = 'abc123def456';

			expect(ContentHashService.compareHashes(hash1, hash2)).toBe(true);
		});

		it('should return false for different hashes', () => {
			const hash1 = 'abc123def456';
			const hash2 = 'xyz789uvw012';

			expect(ContentHashService.compareHashes(hash1, hash2)).toBe(false);
		});

		it('should be case-sensitive', () => {
			const hash1 = 'abc123def456';
			const hash2 = 'ABC123DEF456';

			expect(ContentHashService.compareHashes(hash1, hash2)).toBe(false);
		});

		it('should handle empty strings', () => {
			expect(ContentHashService.compareHashes('', '')).toBe(true);
			expect(ContentHashService.compareHashes('abc', '')).toBe(false);
		});
	});

	describe('verifyHash', () => {
		it('should return true when value matches hash', async () => {
			const value = { name: 'Chocolate Cake', servings: 8 };
			const hash = await ContentHashService.hashContent(value);

			const result = await ContentHashService.verifyHash(value, hash);

			expect(result).toBe(true);
		});

		it('should return false when value does not match hash', async () => {
			const value1 = { name: 'Chocolate Cake' };
			const value2 = { name: 'Vanilla Cake' };

			const hash1 = await ContentHashService.hashContent(value1);

			const result = await ContentHashService.verifyHash(value2, hash1);

			expect(result).toBe(false);
		});

		it('should verify complex nested structures', async () => {
			const value = {
				recipe: {
					name: 'Complex Recipe',
					ingredients: ['flour', 'sugar'],
					nutrition: { calories: 450 },
				},
			};

			const hash = await ContentHashService.hashContent(value);
			const result = await ContentHashService.verifyHash(value, hash);

			expect(result).toBe(true);
		});

		it('should detect tampering in nested objects', async () => {
			const originalValue = {
				recipe: {
					name: 'Original',
					nutrition: { calories: 450 },
				},
			};

			const tamperedValue = {
				recipe: {
					name: 'Original',
					nutrition: { calories: 500 }, // Changed
				},
			};

			const originalHash = await ContentHashService.hashContent(originalValue);
			const result = await ContentHashService.verifyHash(tamperedValue, originalHash);

			expect(result).toBe(false);
		});
	});

	describe('Hash stability over time', () => {
		it('should produce consistent hashes for recipe-like data', async () => {
			const recipeData = {
				name: 'Chocolate Chip Cookies',
				description: 'Delicious homemade cookies',
				recipeIngredient: ['2 cups flour', '1 cup sugar', '2 eggs'],
				recipeInstructions: [
					{ '@type': 'HowToStep', text: 'Preheat oven to 350°F' },
					{ '@type': 'HowToStep', text: 'Mix ingredients' },
					{ '@type': 'HowToStep', text: 'Bake for 12 minutes' },
				],
				nutrition: {
					'@type': 'NutritionInformation',
					calories: '150',
					protein: '2g',
				},
			};

			const hash1 = await ContentHashService.hashContent(recipeData);
			const hash2 = await ContentHashService.hashContent(recipeData);

			expect(hash1).toBe(hash2);
		});
	});
});
