/**
 * Response Middleware
 *
 * Utilities for formatting Lambda responses with proper headers and CORS
 */

import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

/**
 * Standard JSON response with CORS headers
 */
export const json = (code: number, data: unknown): APIGatewayProxyStructuredResultV2 => {
	return {
		statusCode: code,
		headers: {
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin': '*', // CORS - adjust for production
			'Access-Control-Allow-Headers': 'Content-Type,Authorization',
			'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
		},
		body: JSON.stringify(data),
	};
};

/**
 * CORS preflight response
 */
export const corsPreflightResponse = (): APIGatewayProxyStructuredResultV2 => {
	return {
		statusCode: 204,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Headers': 'Content-Type,Authorization',
			'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
		},
		body: '',
	};
};
