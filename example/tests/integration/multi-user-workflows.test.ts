import { describe, it, expect, beforeEach } from 'vitest';
import { handler } from '../../src/lambda.js';
import { buildEvent, buildRecipe, dynamoMock } from '../helpers.js';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

/**
 * Multi-User Workflow Tests
 *
 * Tests user isolation and multi-user scenarios:
 * - User 1 edits recipe, User 2 gets baseline (isolation)
 * - Multiple users edit same recipe independently
 * - Cache hit scenario (User 2 reuses User 1's cached recipe)
 */

const TEST_URL = 'https://example.com/chocolate-chip-cookies';
const TEST_URL_HASH = 'abc123def456';
const USER_1_ID = 'user-1-firebase-uid';
const USER_2_ID = 'user-2-firebase-uid';

describe('Multi-User Workflow Tests', () => {
	beforeEach(() => {
		dynamoMock.reset();
	});

	describe('User Isolation', () => {
		it('should isolate User 1 edits from User 2', async () => {
			// ARRANGE: User 1 has edited the recipe
			const sharedRecipe = buildRecipe({
				urlHash: TEST_URL_HASH,
				url: TEST_URL,
				fields: {
					name: 'Classic Chocolate Chip Cookies',
					description: 'Original description',
				},
			});

			const user1Recipe = buildRecipe({
				urlHash: TEST_URL_HASH,
				url: TEST_URL,
				fields: {
					name: 'My Amazing Cookies', // User 1's custom name
				},
				userId: USER_1_ID,
				source: 'user',
			});

			// Mock: Shared cache returns baseline
			dynamoMock
				.on(GetCommand, {
					TableName: 'test-cookbooks-table',
					Key: { PK: `recipe#${TEST_URL_HASH}`, SK: 'base' },
				})
				.resolves({ Item: sharedRecipe });

			// Mock: User 2 has no custom record
			dynamoMock
				.on(GetCommand, {
					TableName: 'test-cookbooks-table',
					Key: { PK: `user#${USER_2_ID}`, SK: `recipe#${TEST_URL_HASH}` },
				})
				.resolves({ Item: undefined });

			const event = buildEvent({
				method: 'GET',
				path: `/recipe/${TEST_URL_HASH}`,
				pathParams: { urlHash: TEST_URL_HASH },
				userId: USER_2_ID,
			});

			// ACT: User 2 loads recipe
			const response = await handler(event);

			// ASSERT: User 2 gets baseline, NOT User 1's customization
			expect(response.statusCode).toBe(200);

			const body = JSON.parse(response.body as string);
			expect(body).toHaveProperty('recipe');

			// User 2 sees baseline name (not User 1's custom name)
			expect(body.recipe.name).toBe('Classic Chocolate Chip Cookies');
			expect(body.recipe.name).not.toBe('My Amazing Cookies');

			// Verify baseline description is preserved
			expect(body.recipe.description).toBe('Original description');
		});
	});

	describe('Independent User Edits', () => {
		it('should allow both users to edit same recipe independently', async () => {
			// ARRANGE: Shared baseline exists
			const sharedRecipe = buildRecipe({
				urlHash: TEST_URL_HASH,
				url: TEST_URL,
				fields: {
					name: 'Classic Chocolate Chip Cookies',
					description: 'Original description',
				},
			});

			// Mock: Both users get shared baseline
			dynamoMock
				.on(GetCommand, {
					TableName: 'test-cookbooks-table',
					Key: { PK: `recipe#${TEST_URL_HASH}`, SK: 'base' },
				})
				.resolves({ Item: sharedRecipe });

			// Mock: No user customizations initially
			dynamoMock
				.on(GetCommand, {
					TableName: 'test-cookbooks-table',
					Key: { PK: `user#${USER_1_ID}`, SK: `recipe#${TEST_URL_HASH}` },
				})
				.resolves({ Item: undefined });

			dynamoMock
				.on(GetCommand, {
					TableName: 'test-cookbooks-table',
					Key: { PK: `user#${USER_2_ID}`, SK: `recipe#${TEST_URL_HASH}` },
				})
				.resolves({ Item: undefined });

			// Mock: Allow saves
			dynamoMock.on(PutCommand).resolves({});

			// ACT 1: User 1 edits recipe
			const user1Event = buildEvent({
				method: 'PUT',
				path: `/recipe/${TEST_URL_HASH}`,
				pathParams: { urlHash: TEST_URL_HASH },
				userId: USER_1_ID,
				body: {
					recipe: {
						name: 'User 1 Cookies',
						description: 'Original description',
					},
				},
			});

			const user1Response = await handler(user1Event);

			// ASSERT 1: User 1 save succeeds
			expect(user1Response.statusCode).toBe(200);

			const user1Body = JSON.parse(user1Response.body as string);
			expect(user1Body.recipe.name).toBe('User 1 Cookies');

			// Verify User 1's record was saved with correct keys
			const user1PutCalls = dynamoMock.commandCalls(PutCommand);
			expect(user1PutCalls.length).toBeGreaterThan(0);

			const user1SavedItem = user1PutCalls[0].args[0].input.Item;
			expect(user1SavedItem.PK).toBe(`user#${USER_1_ID}`);
			expect(user1SavedItem.SK).toBe(`recipe#${TEST_URL_HASH}`);

			// ACT 2: User 2 edits recipe (independently)
			dynamoMock.reset(); // Clear previous mocks

			// Re-mock: Shared baseline unchanged
			dynamoMock
				.on(GetCommand, {
					TableName: 'test-cookbooks-table',
					Key: { PK: `recipe#${TEST_URL_HASH}`, SK: 'base' },
				})
				.resolves({ Item: sharedRecipe });

			// Re-mock: User 2 has no customizations
			dynamoMock
				.on(GetCommand, {
					TableName: 'test-cookbooks-table',
					Key: { PK: `user#${USER_2_ID}`, SK: `recipe#${TEST_URL_HASH}` },
				})
				.resolves({ Item: undefined });

			dynamoMock.on(PutCommand).resolves({});

			const user2Event = buildEvent({
				method: 'PUT',
				path: `/recipe/${TEST_URL_HASH}`,
				pathParams: { urlHash: TEST_URL_HASH },
				userId: USER_2_ID,
				body: {
					recipe: {
						name: 'User 2 Cookies',
						description: 'Original description',
					},
				},
			});

			const user2Response = await handler(user2Event);

			// ASSERT 2: User 2 save succeeds
			expect(user2Response.statusCode).toBe(200);

			const user2Body = JSON.parse(user2Response.body as string);
			expect(user2Body.recipe.name).toBe('User 2 Cookies');

			// Verify User 2's record was saved with correct keys
			const user2PutCalls = dynamoMock.commandCalls(PutCommand);
			expect(user2PutCalls.length).toBeGreaterThan(0);

			const user2SavedItem = user2PutCalls[0].args[0].input.Item;
			expect(user2SavedItem.PK).toBe(`user#${USER_2_ID}`);
			expect(user2SavedItem.SK).toBe(`recipe#${TEST_URL_HASH}`);

			// Key assertion: User 1 and User 2 have separate records
			expect(user1SavedItem.PK).not.toBe(user2SavedItem.PK);
		});
	});

	describe('Cache Hit Scenario', () => {
		it('should reuse shared cache when User 2 loads after User 1', async () => {
			// ARRANGE: User 1 has already loaded recipe (shared cache exists)
			const sharedRecipe = buildRecipe({
				urlHash: TEST_URL_HASH,
				url: TEST_URL,
				fields: {
					name: 'Classic Chocolate Chip Cookies',
					description: 'Delicious homemade cookies',
				},
			});

			// Mock: Shared cache exists (created by User 1)
			dynamoMock
				.on(GetCommand, {
					TableName: 'test-cookbooks-table',
					Key: { PK: `recipe#${TEST_URL_HASH}`, SK: 'base' },
				})
				.resolves({ Item: sharedRecipe });

			// Mock: User 2 has no custom record
			dynamoMock
				.on(GetCommand, {
					TableName: 'test-cookbooks-table',
					Key: { PK: `user#${USER_2_ID}`, SK: `recipe#${TEST_URL_HASH}` },
				})
				.resolves({ Item: undefined });

			const event = buildEvent({
				method: 'GET',
				path: `/recipe/${TEST_URL_HASH}`,
				pathParams: { urlHash: TEST_URL_HASH },
				userId: USER_2_ID,
			});

			// ACT: User 2 loads recipe
			const response = await handler(event);

			// ASSERT: User 2 gets shared cache (baseline recipe)
			expect(response.statusCode).toBe(200);

			const body = JSON.parse(response.body as string);
			expect(body).toHaveProperty('recipe');

			// User 2 sees baseline from shared cache
			expect(body.recipe.name).toBe('Classic Chocolate Chip Cookies');
			expect(body.recipe.description).toBe('Delicious homemade cookies');

			// Verify shared cache was queried
			const getCalls = dynamoMock.commandCalls(GetCommand);
			const sharedCacheCall = getCalls.find(
				(call) =>
					call.args[0].input.Key?.PK === `recipe#${TEST_URL_HASH}` &&
					call.args[0].input.Key?.SK === 'base'
			);
			expect(sharedCacheCall).toBeDefined();
		});
	});
});
