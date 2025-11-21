/**
 * Request Middleware
 *
 * Utilities for parsing and validating request data
 */

import type { APIGatewayProxyEventV2 } from 'aws-lambda';

/**
 * Parse request body as JSON
 * Returns null if body is missing or invalid JSON
 */
export const parseBody = <T>(event: APIGatewayProxyEventV2): T | null => {
	if (!event.body) return null;

	try {
		return JSON.parse(event.body) as T;
	} catch (error) {
		return null;
	}
};

/**
 * Extract path parameter from event
 * Returns null if parameter is missing
 */
export const getPathParam = (event: APIGatewayProxyEventV2, paramName: string): string | null => {
	return event.pathParameters?.[paramName] || null;
};
