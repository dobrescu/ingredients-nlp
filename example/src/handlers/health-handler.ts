/**
 * Health Check Handler
 *
 * Simple health endpoint for monitoring/load balancers
 */

import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { json } from '../middleware/response.js';

export const handleHealth = (): APIGatewayProxyStructuredResultV2 => {
	return json(200, {
		status: 'ok',
		timestamp: new Date().toISOString(),
	});
};
