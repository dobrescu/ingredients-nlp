/**
 * Authentication Middleware
 *
 * Utilities for extracting and validating Firebase authentication
 */

import type { APIGatewayProxyEventV2 } from 'aws-lambda';

/**
 * Extract Firebase UID from JWT claims (pre-validated by API Gateway)
 * API Gateway V2 stores JWT claims directly in requestContext
 */
export const getFirebaseUID = (event: APIGatewayProxyEventV2): string | null => {
	// In API Gateway V2 with JWT authorizer, claims are in event.requestContext
	// The 'sub' claim contains the Firebase UID
	const requestContext = event.requestContext as any;
	const claims = requestContext.authorizer?.jwt?.claims;
	return (claims?.sub as string) || null;
};
