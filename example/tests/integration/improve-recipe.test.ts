import { describe, it, expect, beforeEach } from 'vitest';
import { handler } from '../../src/lambda.js';
import { buildEvent, buildRecipe, dynamoMock, s3Mock, bedrockMock } from '../helpers.js';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { sdkStreamMixin } from '@smithy/util-stream';
import { Readable } from 'stream';

/**
 * Workflow Test: Improve Recipe
 *
 * Tests POST /recipe/:urlHash/improve - AI-powered recipe improvement.
 *
 * NOTE: This endpoint requires USE_AI='true' in environment.
 * Tests are currently basic error scenarios only.
 *
 * Covered scenarios:
 * - Error: 401 unauthorized (missing auth)
 * - Error: 404 when route doesn't match
 */

const TEST_URL = 'https://example.com/chocolate-chip-cookies';
const TEST_URL_HASH = 'abc123def456';
const TEST_USER_ID = 'test-user-123';

// Helper to mock S3 JSON response
function mockS3JsonResponse(data: unknown) {
	const stream = new Readable();
	stream.push(JSON.stringify(data));
	stream.push(null);
	const sdkStream = sdkStreamMixin(stream);

	s3Mock.on(GetObjectCommand).resolves({
		Body: sdkStream as any,
	});
}

describe('Improve Recipe Workflow', () => {
	beforeEach(() => {
		dynamoMock.reset();
		s3Mock.reset();
		bedrockMock.reset();
	});

	// Note: Happy path tests require USE_AI='true' which is disabled in test environment
	// LLM integration is tested separately in tests/integration/llm-services.test.ts

	describe('Error Cases', () => {
		it('should return 401 when auth is missing', async () => {
			// ARRANGE: Event without auth
			const event = buildEvent({
				method: 'POST',
				path: `/recipe/${TEST_URL_HASH}/improve`,
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
				method: 'POST',
				path: '/recipe//improve',
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
