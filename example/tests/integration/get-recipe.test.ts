import { describe, it, expect, beforeEach } from 'vitest';
import { handler } from '../../src/lambda.js';
import { buildEvent, buildRecipe, dynamoMock } from '../helpers.js';
import { GetCommand } from '@aws-sdk/lib-dynamodb';

/**
 * Workflow Test: Get Recipe
 *
 * Tests GET /recipe/:urlHash - Retrieving a recipe from cache.
 *
 * Covered scenarios:
 * - Happy path: Shared cache only (no user customizations)
 * - Happy path: User customizations merged with baseline
 * - Error: 404 recipe not found
 * - Error: 401 unauthorized (missing auth)
 */

const TEST_URL = 'https://example.com/chocolate-chip-cookies';
const TEST_URL_HASH = 'abc123def456';
const TEST_USER_ID = 'test-user-123';

describe('Get Recipe Workflow', () => {
	beforeEach(() => {
		dynamoMock.reset();
	});

	describe('Happy Path - Shared Cache', () => {
		it('should return recipe from shared cache when no user version exists', async () => {
			// ARRANGE: Mock shared cache has recipe
			const sharedRecipe = buildRecipe({
				urlHash: TEST_URL_HASH,
				url: TEST_URL,
				fields: {
					name: 'Classic Chocolate Chip Cookies',
					description: 'Delicious homemade cookies',
				},
			});

			// Mock: getSharedRecipe() returns recipe, getUserRecipe() returns undefined
			dynamoMock
				.on(GetCommand, {
					TableName: 'test-cookbooks-table',
					Key: { PK: `recipe#${TEST_URL_HASH}`, SK: 'base' },
				})
				.resolves({ Item: sharedRecipe });

			dynamoMock
				.on(GetCommand, {
					TableName: 'test-cookbooks-table',
					Key: { PK: `user#${TEST_USER_ID}`, SK: `recipe#${TEST_URL_HASH}` },
				})
				.resolves({ Item: undefined });

			const event = buildEvent({
				method: 'GET',
				path: `/recipe/${TEST_URL_HASH}`,
				pathParams: { urlHash: TEST_URL_HASH },
			});

			// ACT: Call handler
			const response = await handler(event);

			// ASSERT: Success response
			expect(response.statusCode).toBe(200);

			const body = JSON.parse(response.body as string);
			expect(body).toHaveProperty('recipe');
			expect(body.recipe.name).toBe('Classic Chocolate Chip Cookies');
			expect(body.recipe.description).toBe('Delicious homemade cookies');
		});
	});

	describe('Happy Path - User Customizations', () => {
		it('should merge user customizations with shared baseline', async () => {
			// ARRANGE: Both shared and user recipes exist
			const sharedRecipe = buildRecipe({
				urlHash: TEST_URL_HASH,
				url: TEST_URL,
				fields: {
					name: 'Classic Chocolate Chip Cookies',
					description: 'Delicious homemade cookies',
				},
			});

			const userRecipe = buildRecipe({
				urlHash: TEST_URL_HASH,
				url: TEST_URL,
				fields: {
					name: 'My Favorite Cookies', // User customized
				},
				userId: TEST_USER_ID,
				source: 'user',
			});

			// Mock: getSharedRecipe() returns baseline
			dynamoMock
				.on(GetCommand, {
					TableName: 'test-cookbooks-table',
					Key: { PK: `recipe#${TEST_URL_HASH}`, SK: 'base' },
				})
				.resolves({ Item: sharedRecipe });

			// Mock: getUserRecipe() returns user customizations
			dynamoMock
				.on(GetCommand, {
					TableName: 'test-cookbooks-table',
					Key: { PK: `user#${TEST_USER_ID}`, SK: `recipe#${TEST_URL_HASH}` },
				})
				.resolves({ Item: userRecipe });

			const event = buildEvent({
				method: 'GET',
				path: `/recipe/${TEST_URL_HASH}`,
				pathParams: { urlHash: TEST_URL_HASH },
				userId: TEST_USER_ID,
			});

			// ACT: Call handler
			const response = await handler(event);

			// ASSERT: Success response with merged data
			expect(response.statusCode).toBe(200);

			const body = JSON.parse(response.body as string);
			expect(body).toHaveProperty('recipe');

			// User's custom name should override shared
			expect(body.recipe.name).toBe('My Favorite Cookies');

			// Shared description should be preserved (not in user record)
			expect(body.recipe.description).toBe('Delicious homemade cookies');
		});
	});

	describe('Error Cases', () => {
		it('should return 404 when recipe not found', async () => {
			// ARRANGE: Both shared and user queries return nothing
			dynamoMock.on(GetCommand).resolves({ Item: undefined });

			const event = buildEvent({
				method: 'GET',
				path: `/recipe/${TEST_URL_HASH}`,
				pathParams: { urlHash: TEST_URL_HASH },
			});

			// ACT: Call handler
			const response = await handler(event);

			// ASSERT: Not found
			expect(response.statusCode).toBe(404);

			const body = JSON.parse(response.body as string);
			expect(body).toHaveProperty('error', 'Recipe not found');
		});

		it('should return 401 when auth is missing', async () => {
			// ARRANGE: Event without auth
			const event = buildEvent({
				method: 'GET',
				path: `/recipe/${TEST_URL_HASH}`,
				pathParams: { urlHash: TEST_URL_HASH },
				auth: false,
			});

			// ACT: Call handler
			const response = await handler(event);

			// ASSERT: Unauthorized
			expect(response.statusCode).toBe(401);

			const body = JSON.parse(response.body as string);
			expect(body).toHaveProperty('error', 'Unauthorized');
		});

		it('should return 404 when urlHash path parameter is missing', async () => {
			// ARRANGE: Event without path parameter
			const event = buildEvent({
				method: 'GET',
				path: '/recipe/',
			});

			// ACT: Call handler
			const response = await handler(event);

			// ASSERT: Not found (route doesn't match)
			expect(response.statusCode).toBe(404);

			const body = JSON.parse(response.body as string);
			expect(body).toHaveProperty('error', 'Not Found');
		});
	});
});
