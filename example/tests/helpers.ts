/**
 * Test Helpers
 *
 * Simple utilities for building test data.
 * Keep it minimal - only what's immediately needed.
 */

import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import type { StoredRecipe } from '../src/types/recipe/managed-recipe.js';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { vi } from 'vitest';
import apiGatewayEventFixture from './fixtures/lambda/api-gateway-event.json';

// Export mock clients for tests to use
export const dynamoMock = mockClient(DynamoDBDocumentClient);
export const s3Mock = mockClient(S3Client);
export const bedrockMock = mockClient(BedrockRuntimeClient);

/**
 * Build API Gateway event with minimal boilerplate
 *
 * @example
 * // Authenticated POST with body
 * buildEvent({ method: 'POST', path: '/recipe/load', body: { url: 'https://...' } })
 *
 * // Unauthenticated GET
 * buildEvent({ method: 'GET', path: '/health', auth: false })
 *
 * // With path parameters
 * buildEvent({ method: 'GET', path: '/recipe/abc123', pathParams: { urlHash: 'abc123' } })
 */
export function buildEvent(overrides: {
	method?: string;
	path?: string;
	body?: unknown;
	pathParams?: Record<string, string>;
	userId?: string;
	auth?: boolean; // Default true
} = {}): APIGatewayProxyEventV2 {
	const {
		method = 'GET',
		path = '/',
		body,
		pathParams,
		userId = 'test-user-123',
		auth = true,
	} = overrides;

	const event: APIGatewayProxyEventV2 = {
		...apiGatewayEventFixture,
		requestContext: {
			...apiGatewayEventFixture.requestContext,
			http: {
				...apiGatewayEventFixture.requestContext.http,
				method,
				path,
			},
		} as any,
		rawPath: path,
		body: body ? JSON.stringify(body) : undefined,
		pathParameters: pathParams,
	} as APIGatewayProxyEventV2;

	// Add auth if enabled
	if (auth) {
		(event.requestContext as any).authorizer = {
			jwt: {
				claims: {
					sub: userId,
				},
			},
		};
	} else {
		(event.requestContext as any).authorizer = undefined;
	}

	return event;
}

/**
 * Build StoredRecipe (DynamoDB format) with minimal boilerplate
 *
 * @example
 * // Simple recipe
 * buildRecipe({
 *   urlHash: 'abc123',
 *   url: 'https://example.com/recipe',
 *   fields: { name: 'Chocolate Chip Cookies' }
 * })
 *
 * // User recipe
 * buildRecipe({
 *   urlHash: 'abc123',
 *   url: 'https://example.com/recipe',
 *   fields: { name: 'My Custom Name' },
 *   userId: 'user-123'
 * })
 */
export function buildRecipe(params: {
	urlHash: string;
	url: string;
	fields: Record<string, any>;
	userId?: string; // If provided, creates user recipe (PK: user#uid)
	source?: 'prepper' | 'llm' | 'user';
}): StoredRecipe {
	const { urlHash, url, fields: fieldData, userId, source = 'prepper' } = params;

	// Convert field data to stringified ManagedField format
	const fields: Record<string, string> = {};

	for (const [fieldName, fieldValue] of Object.entries(fieldData)) {
		fields[fieldName] = JSON.stringify({
			value: fieldValue,
			rendered: {
				type: 'markdown',
				value: typeof fieldValue === 'string' ? fieldValue : JSON.stringify(fieldValue),
				version: '1.0.0',
			},
			currentHash: `hash-${fieldName}`,
			baseHash: `hash-${fieldName}`,
			history: [
				{
					timestamp: new Date().toISOString(),
					hash: `hash-${fieldName}`,
					source,
					actor: userId || 'system',
					summary: source === 'user' ? 'User edit' : 'Initial ingestion',
				},
			],
		});
	}

	return {
		PK: userId ? `user#${userId}` : `recipe#${urlHash}`,
		SK: userId ? `recipe#${urlHash}` : 'base',
		urlHash,
		originalUrl: url,
		createdAt: new Date().toISOString(),
		lastModified: new Date().toISOString(),
		schemaVersion: '1.0.0',
		fields,
	};
}

/**
 * Setup global mocks for AWS services
 *
 * Called from tests/setup.ts to configure mocks once globally.
 * Individual tests can override with specific responses.
 */
export function setupMocks() {
	// Reset all mocks before each test
	dynamoMock.reset();
	s3Mock.reset();
	bedrockMock.reset();

	// Mock fetch for Prepper calls
	global.fetch = vi.fn();
}
