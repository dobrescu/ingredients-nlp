import { describe, it, expect, beforeEach } from 'vitest';
import { handler } from '../../src/lambda.js';
import { buildEvent, buildRecipe, dynamoMock } from '../helpers.js';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

/**
 * Workflow Test: Update Recipe
 *
 * Tests PUT /recipe/:urlHash - Updating recipe fields with user edits.
 *
 * Covered scenarios:
 * - Happy path: Update single field
 * - Happy path: Update multiple fields
 * - Validation: Changed fields detected correctly
 * - Error: 401 unauthorized (missing auth)
 * - Error: 400 missing recipe object
 */

const TEST_URL = 'https://example.com/chocolate-chip-cookies';
const TEST_URL_HASH = 'abc123def456';
const TEST_USER_ID = 'test-user-123';

describe('Update Recipe Workflow', () => {
	beforeEach(() => {
		dynamoMock.reset();
	});

	describe('Happy Path - Single Field Update', () => {
		it('should update single field and return changed fields', async () => {
			// ARRANGE: Existing recipe in shared cache
			const existingRecipe = buildRecipe({
				urlHash: TEST_URL_HASH,
				url: TEST_URL,
				fields: {
					name: 'Classic Chocolate Chip Cookies',
					description: 'Delicious homemade cookies',
				},
			});

			// Mock: Get existing recipe
			dynamoMock
				.on(GetCommand, {
					TableName: 'test-cookbooks-table',
					Key: { PK: `recipe#${TEST_URL_HASH}`, SK: 'base' },
				})
				.resolves({ Item: existingRecipe });

			dynamoMock
				.on(GetCommand, {
					TableName: 'test-cookbooks-table',
					Key: { PK: `user#${TEST_USER_ID}`, SK: `recipe#${TEST_URL_HASH}` },
				})
				.resolves({ Item: undefined });

			// Mock: Save updated recipe
			dynamoMock.on(PutCommand).resolves({});

			const event = buildEvent({
				method: 'PUT',
				path: `/recipe/${TEST_URL_HASH}`,
				pathParams: { urlHash: TEST_URL_HASH },
				body: {
					recipe: {
						name: 'My Favorite Chocolate Chip Cookies', // Updated
					},
				},
			});

			// ACT: Call handler
			const response = await handler(event);

			// ASSERT: Success response
			expect(response.statusCode).toBe(200);

			const body = JSON.parse(response.body as string);
			expect(body).toHaveProperty('recipe');
			expect(body).toHaveProperty('changedFields');

			// Verify changed fields array
			expect(body.changedFields).toContain('name');
			expect(body.changedFields.length).toBe(1);

			// Verify updated value
			expect(body.recipe.name).toBe('My Favorite Chocolate Chip Cookies');

			// Verify unchanged field preserved
			expect(body.recipe.description).toBe('Delicious homemade cookies');

			// Verify user record was saved
			const putCalls = dynamoMock.commandCalls(PutCommand);
			expect(putCalls.length).toBeGreaterThan(0);
			const putCall = putCalls[0];
			expect(putCall.args[0].input.Item.PK).toBe(`user#${TEST_USER_ID}`);
			expect(putCall.args[0].input.Item.SK).toBe(`recipe#${TEST_URL_HASH}`);
		});
	});

	describe('Happy Path - Multiple Fields Update', () => {
		it('should update multiple fields and detect all changes', async () => {
			// ARRANGE: Existing recipe
			const existingRecipe = buildRecipe({
				urlHash: TEST_URL_HASH,
				url: TEST_URL,
				fields: {
					name: 'Classic Chocolate Chip Cookies',
					description: 'Delicious homemade cookies',
					prepTime: 'PT15M',
				},
			});

			dynamoMock
				.on(GetCommand, {
					TableName: 'test-cookbooks-table',
					Key: { PK: `recipe#${TEST_URL_HASH}`, SK: 'base' },
				})
				.resolves({ Item: existingRecipe });

			dynamoMock
				.on(GetCommand, {
					TableName: 'test-cookbooks-table',
					Key: { PK: `user#${TEST_USER_ID}`, SK: `recipe#${TEST_URL_HASH}` },
				})
				.resolves({ Item: undefined });

			dynamoMock.on(PutCommand).resolves({});

			const event = buildEvent({
				method: 'PUT',
				path: `/recipe/${TEST_URL_HASH}`,
				pathParams: { urlHash: TEST_URL_HASH },
				body: {
					recipe: {
						name: 'Updated Name',
						description: 'Updated Description',
					},
				},
			});

			// ACT: Call handler
			const response = await handler(event);

			// ASSERT: Success response
			expect(response.statusCode).toBe(200);

			const body = JSON.parse(response.body as string);
			expect(body.changedFields).toContain('name');
			expect(body.changedFields).toContain('description');
			expect(body.changedFields.length).toBe(2);
		});
	});

	describe('Error Cases', () => {
		it('should return 401 when auth is missing', async () => {
			// ARRANGE: Event without auth
			const event = buildEvent({
				method: 'PUT',
				path: `/recipe/${TEST_URL_HASH}`,
				pathParams: { urlHash: TEST_URL_HASH },
				body: {
					recipe: { name: 'Updated' },
				},
				auth: false,
			});

			// ACT: Call handler
			const response = await handler(event);

			// ASSERT: Unauthorized
			expect(response.statusCode).toBe(401);

			const body = JSON.parse(response.body as string);
			expect(body).toHaveProperty('error', 'Unauthorized');
		});

		it('should return 400 when recipe object is missing', async () => {
			// ARRANGE: Event without recipe in body
			const event = buildEvent({
				method: 'PUT',
				path: `/recipe/${TEST_URL_HASH}`,
				pathParams: { urlHash: TEST_URL_HASH },
				body: {}, // Missing recipe
			});

			// ACT: Call handler
			const response = await handler(event);

			// ASSERT: Bad request
			expect(response.statusCode).toBe(400);

			const body = JSON.parse(response.body as string);
			expect(body).toHaveProperty('error');
			expect(body.error).toContain('recipe');
		});

		it('should return 404 when urlHash path parameter is missing', async () => {
			// ARRANGE: Event without path parameter
			const event = buildEvent({
				method: 'PUT',
				path: '/recipe/',
				body: {
					recipe: { name: 'Updated' },
				},
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
