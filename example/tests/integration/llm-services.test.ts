import { describe, it, expect, vi, beforeEach } from 'vitest';
import headlineFixture from '../fixtures/llm/bedrock-headline-response.json';
import extrasFixture from '../fixtures/llm/bedrock-extras-response.json';

/**
 * Integration tests for LLM services with mocked Bedrock responses
 *
 * These tests verify:
 * - Service layer correctly processes mocked LLM responses
 * - Response parsing and validation works correctly
 * - Error handling for invalid responses
 * - No actual LLM API calls are made (deterministic, fast tests)
 */

// Hoist mock factory to module scope
const mockSend = vi.fn();

// Mock AWS SDK at top level with proper constructors
vi.mock('@aws-sdk/client-bedrock-runtime', () => {
	return {
		BedrockRuntimeClient: class {
			send = mockSend;
		},
		InvokeModelCommand: class {
			constructor(params: unknown) {
				// Store params if needed for assertions
				Object.assign(this, params);
			}
		},
	};
});

// Import services AFTER mocking
const { HeadlineGenerationService } = await import('../../src/prompts/generate-headline/index.js');
const { RecipeExtrasService } = await import('../../src/prompts/recipe-extras/index.js');

describe('LLM Services Integration', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('HeadlineGenerationService', () => {
		it('should generate headline with mocked Bedrock response', async () => {
			mockSend.mockResolvedValueOnce({
				body: {
					transformToString: async () => JSON.stringify(headlineFixture),
				},
			});

			const service = HeadlineGenerationService.create();
			const result = await service.generateHeadline({
				name: 'Classic Chocolate Chip Cookies',
				description: 'The best homemade chocolate chip cookies',
			});

			expect(result).toHaveProperty('headline');
			expect(result.headline).toBe('Golden, Crispy, and Perfectly Sweet');
			expect(mockSend).toHaveBeenCalledTimes(1);
		});

		it('should handle missing description gracefully', async () => {
			mockSend.mockResolvedValueOnce({
				body: {
					transformToString: async () => JSON.stringify(headlineFixture),
				},
			});

			const service = HeadlineGenerationService.create();
			const result = await service.generateHeadline({
				name: 'Classic Chocolate Chip Cookies',
			});

			expect(result).toHaveProperty('headline');
			expect(typeof result.headline).toBe('string');
		});

		it('should throw on invalid LLM response structure', async () => {
			const invalidResponse = {
				id: 'msg_123',
				type: 'message',
				content: [
					{
						type: 'text',
						text: '{"invalid":"structure"}', // Missing 'headline' field
					},
				],
			};

			mockSend.mockResolvedValueOnce({
				body: {
					transformToString: async () => JSON.stringify(invalidResponse),
				},
			});

			const service = HeadlineGenerationService.create();

			await expect(
				service.generateHeadline({
					name: 'Test Recipe',
				})
			).rejects.toThrow();
		});
	});

	describe('RecipeExtrasService', () => {
		it('should extract extras with mocked Bedrock response', async () => {
			mockSend.mockResolvedValueOnce({
				body: {
					transformToString: async () => JSON.stringify(extrasFixture),
				},
			});

			const service = RecipeExtrasService.create();
			const result = await service.extractExtras({
				rawHtml: '<html><body>Test recipe content</body></html>',
				minificationMap: {
					div: 'c',
					h2: 'd',
					p: 'e',
				},
			});

			expect(result).toHaveProperty('extras');
			expect(result.extras).toBeTypeOf('object');
			expect(result.extras).toHaveProperty('recipeYield');
			expect(result.extras.recipeYield).toBe('24 cookies');
			expect(result.extras).toHaveProperty('totalTime');
			expect(result.extras.totalTime).toBe('PT45M');
			expect(result.extras).toHaveProperty('keywords');
			expect(Array.isArray(result.extras.keywords)).toBe(true);
			expect(mockSend).toHaveBeenCalledTimes(1);
		});

		it('should throw when minification map is missing', async () => {
			const service = RecipeExtrasService.create();

			await expect(
				service.extractExtras({
					rawHtml: '<html><body>Test recipe content</body></html>',
					// Missing minificationMap - required by validation
				})
			).rejects.toThrow('Raw HTML and minification map are required');
		});

		it('should throw on invalid extras response structure', async () => {
			const invalidResponse = {
				id: 'msg_123',
				type: 'message',
				content: [
					{
						type: 'text',
						text: '{"wrong":"field"}', // Missing 'extras' field
					},
				],
			};

			mockSend.mockResolvedValueOnce({
				body: {
					transformToString: async () => JSON.stringify(invalidResponse),
				},
			});

			const service = RecipeExtrasService.create();

			await expect(
				service.extractExtras({
					rawHtml: '<html><body>Test</body></html>',
					minificationMap: { div: 'c' },
				})
			).rejects.toThrow();
		});
	});
});
