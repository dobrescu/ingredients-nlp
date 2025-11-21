/**
 * Lambda Handler - RESTful API Router
 *
 * Declarative routing using path-to-regexp for clean, maintainable route definitions.
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { match } from 'path-to-regexp';
import { handleLoadRecipe, handleGetRecipe, handleUpdateRecipe, handleImproveRecipe } from './handlers/recipe-handlers.js';
import { handleHealth } from './handlers/health-handler.js';
import { json, corsPreflightResponse } from './middleware/response.js';
import { logger } from './utils/logger/logger.js';

type RouteHandler = (
	event: APIGatewayProxyEventV2,
	params: Record<string, string>
) => Promise<APIGatewayProxyStructuredResultV2>;

type Route = {
	method: string;
	pattern: string;
	handler: RouteHandler;
};

const routes: Route[] = [
	{
		method: 'GET',
		pattern: '/health',
		handler: async () => handleHealth()
	},
	{
		method: 'POST',
		pattern: '/recipe/load',
		handler: async (event) => handleLoadRecipe(event)
	},
	{
		method: 'POST',
		pattern: '/recipe/:urlHash/improve',
		handler: async (event, params) => {
			event.pathParameters = params;
			return handleImproveRecipe(event);
		}
	},
	{
		method: 'GET',
		pattern: '/recipe/:urlHash',
		handler: async (event, params) => {
			event.pathParameters = params;
			return handleGetRecipe(event);
		}
	},
	{
		method: 'PUT',
		pattern: '/recipe/:urlHash',
		handler: async (event, params) => {
			event.pathParameters = params;
			return handleUpdateRecipe(event);
		}
	}
];

export const handler = async (
	event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> => {
	const { method, path } = event.requestContext.http;

	logger.info('Request received', { method, path });

	try {
		if (method === 'OPTIONS') {
			return corsPreflightResponse();
		}

		// First pass: try to find exact method+path match
		for (const route of routes) {
			if (route.method !== method) continue;

			const matcher = match(route.pattern, { decode: decodeURIComponent });
			const matched = matcher(path);

			if (matched) {
				const params = matched.params as Record<string, string>;
				return route.handler(event, params);
			}
		}

		// Second pass: check if path exists with different method (405)
		for (const route of routes) {
			const matcher = match(route.pattern, { decode: decodeURIComponent });
			const matched = matcher(path);

			if (matched) {
				return json(405, { error: 'Method Not Allowed' });
			}
		}

		// No path match at all (404)
		return json(404, { error: 'Not Found', message: `Route ${method} ${path} not found` });
	} catch (error) {
		logger.error('Unhandled error in Lambda handler', { error, method, path });
		const message = error instanceof Error ? error.message : String(error);
		return json(500, { error: `Internal server error: ${message}`, code: 'INTERNAL_ERROR' });
	}
};
