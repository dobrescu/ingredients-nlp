import { describe, it, expect, beforeEach } from 'vitest';
import { handler } from '../../src/lambda.js';
import { buildEvent, buildRecipe, dynamoMock, s3Mock } from '../helpers.js';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import prepperFixture from '../fixtures/prepper/valid-recipe-page.json';

/**
 * Workflow Test: Load Recipe
 *
 * Tests POST /recipe/load - Loading a recipe from Prepper and caching it.
 *
 * Covered scenarios:
 * - Happy path: Cache miss (Prepper → save → return)
 * - Happy path: Cache hit (return from DynamoDB)
 * - Error: 401 unauthorized (missing auth)
 * - Error: 400 missing URL parameter
 * - Edge case: Prepper service failure
 */

const TEST_URL = 'https://example.com/chocolate-chip-cookies';
const TEST_URL_HASH = 'abc123def456';

describe('Load Recipe Workflow', () => {
	beforeEach(() => {
		dynamoMock.reset();
		s3Mock.reset();
	});

	describe('Happy Path - Cache Miss', () => {
		it('should load recipe from Prepper when not cached', async () => {
			// ARRANGE: Mock cache miss
			dynamoMock.on(GetCommand).resolves({ Item: undefined });

			// Mock: Prepper returns recipe
			(global.fetch as any).mockResolvedValueOnce({
				ok: true,
				json: async () => prepperFixture,
			});

			// Mock: DynamoDB save (both shared cache and user record)
			dynamoMock.on(PutCommand).resolves({});

			// Mock: S3 save
			s3Mock.on(PutObjectCommand).resolves({});

			const event = buildEvent({
				method: 'POST',
				path: '/recipe/load',
				body: { url: TEST_URL },
			});

			// ACT: Call handler
			const response = await handler(event);

			// ASSERT: Success response
			expect(response.statusCode).toBe(200);
			expect(response.headers?.['Content-Type']).toBe('application/json');

			const body = JSON.parse(response.body as string);
			expect(body).toHaveProperty('urlHash'); // NEW: Verify urlHash is returned
			expect(body).toHaveProperty('recipe');
			expect(body).toHaveProperty('cached', false);
			expect(body.recipe).toHaveProperty('name');

			// Verify Prepper was called (GET with URL param)
			expect(global.fetch).toHaveBeenCalledWith(
				expect.stringContaining(encodeURIComponent(TEST_URL)),
				expect.objectContaining({
					method: 'GET',
				})
			);

			// Verify DynamoDB save was called TWICE (shared cache + user record)
			const dynamoCalls = dynamoMock.commandCalls(PutCommand);
			expect(dynamoCalls.length).toBe(2);

			// Verify S3 save was called
			const s3Calls = s3Mock.commandCalls(PutObjectCommand);
			expect(s3Calls.length).toBeGreaterThan(0);
		});
	});

	describe('Happy Path - Cache Hit', () => {
		it('should return cached recipe and save to user record', async () => {
			// ARRANGE: Mock cache hit
			const cachedRecipe = buildRecipe({
				urlHash: TEST_URL_HASH,
				url: TEST_URL,
				fields: {
					name: 'Classic Chocolate Chip Cookies',
					description: 'Delicious homemade cookies',
				},
			});

			dynamoMock.on(GetCommand).resolves({ Item: cachedRecipe });

			// Mock: DynamoDB save (user record)
			dynamoMock.on(PutCommand).resolves({});

			const event = buildEvent({
				method: 'POST',
				path: '/recipe/load',
				body: { url: TEST_URL },
			});

			// ACT: Call handler
			const response = await handler(event);

			// ASSERT: Success response
			expect(response.statusCode).toBe(200);

			const body = JSON.parse(response.body as string);
			expect(body).toHaveProperty('urlHash'); // NEW: Verify urlHash is returned
			expect(body).toHaveProperty('recipe');
			expect(body).toHaveProperty('cached', true);
			expect(body.recipe.name).toBe('Classic Chocolate Chip Cookies');

			// Verify Prepper was NOT called
			expect(global.fetch).not.toHaveBeenCalled();

			// Verify DynamoDB save was called ONCE (user record only, shared cache already exists)
			const putCalls = dynamoMock.commandCalls(PutCommand);
			expect(putCalls.length).toBe(1);
		});
	});

	describe('Error Cases', () => {
		it('should return 401 when auth is missing', async () => {
			// ARRANGE: Event without auth
			const event = buildEvent({
				method: 'POST',
				path: '/recipe/load',
				body: { url: TEST_URL },
				auth: false,
			});

			// ACT: Call handler
			const response = await handler(event);

			// ASSERT: Unauthorized
			expect(response.statusCode).toBe(401);

			const body = JSON.parse(response.body as string);
			expect(body).toHaveProperty('error', 'Unauthorized');
		});

		it('should return 400 when URL parameter is missing', async () => {
			// ARRANGE: Event without URL in body
			const event = buildEvent({
				method: 'POST',
				path: '/recipe/load',
				body: {}, // Missing url
			});

			// ACT: Call handler
			const response = await handler(event);

			// ASSERT: Bad request
			expect(response.statusCode).toBe(400);

			const body = JSON.parse(response.body as string);
			expect(body).toHaveProperty('error');
			expect(body.error).toContain('url');
		});

		it('should return 400 when request body is malformed', async () => {
			// ARRANGE: Event with invalid JSON
			const event = buildEvent({
				method: 'POST',
				path: '/recipe/load',
			});
			event.body = 'invalid-json{';

			// ACT: Call handler
			const response = await handler(event);

			// ASSERT: Bad request
			expect(response.statusCode).toBe(400);

			const body = JSON.parse(response.body as string);
			expect(body).toHaveProperty('error');
		});
	});

	describe('Edge Cases', () => {
		it('should handle Prepper service failure gracefully', async () => {
			// ARRANGE: Mock cache miss
			dynamoMock.on(GetCommand).resolves({ Item: undefined });

			// Mock: Prepper fails
			(global.fetch as any).mockResolvedValueOnce({
				ok: false,
				status: 500,
				text: async () => 'Internal Server Error',
			});

			const event = buildEvent({
				method: 'POST',
				path: '/recipe/load',
				body: { url: TEST_URL },
			});

			// ACT: Call handler
			const response = await handler(event);

			// ASSERT: Server error
			expect(response.statusCode).toBe(500);

			const body = JSON.parse(response.body as string);
			expect(body).toHaveProperty('error');
			expect(body.error).toContain('Failed to load recipe');
		});

		it('should handle Prepper returning invalid JSON', async () => {
			// ARRANGE: Mock cache miss
			dynamoMock.on(GetCommand).resolves({ Item: undefined });

			// Mock: Prepper returns invalid data
			(global.fetch as any).mockResolvedValueOnce({
				ok: true,
				json: async () => ({ recipes: [] }), // Empty recipes array
			});

			const event = buildEvent({
				method: 'POST',
				path: '/recipe/load',
				body: { url: TEST_URL },
			});

			// ACT: Call handler
			const response = await handler(event);

			// ASSERT: Server error (no valid recipe)
			expect(response.statusCode).toBe(500);

			const body = JSON.parse(response.body as string);
			expect(body).toHaveProperty('error');
		});
	});
});
