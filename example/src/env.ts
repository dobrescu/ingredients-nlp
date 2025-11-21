/**
 * Environment Configuration
 *
 * Centralized environment variable access with validation.
 * Fail fast on missing required variables.
 */

import path from 'path';
import dotenv from 'dotenv';

// Load .env file
dotenv.config({ path: path.join(process.cwd(), '.env') });

export const env = {
	// AWS Configuration
	AWS_REGION: process.env.AWS_REGION ?? 'us-east-1',

	// DynamoDB (required)
	DYNAMODB_COOKBOOKS: process.env.DYNAMODB_COOKBOOKS!,

	// S3 (required)
	S3_COOKBOOKS: process.env.S3_COOKBOOKS!,

	// Prepper Service (optional)
	PREPPER_URL: process.env.PREPPER_URL || 'http://localhost:9000',

	// AI Features (optional)
	USE_AI: process.env.USE_AI === 'true',
	OPENAI_API_KEY: process.env.OPENAI_API_KEY,
} as const;

// Validate required environment variables
const requiredVars = {
	DYNAMODB_COOKBOOKS: env.DYNAMODB_COOKBOOKS,
	S3_COOKBOOKS: env.S3_COOKBOOKS,
};

for (const [name, value] of Object.entries(requiredVars)) {
	if (!value) {
		throw new Error(`Missing required environment variable: ${name}`);
	}
}
