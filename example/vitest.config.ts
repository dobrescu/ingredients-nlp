import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		// Use node environment (not browser)
		environment: 'node',

		// Setup files run before each test file
		setupFiles: ['./tests/setup.ts'],

		// Environment variables for tests (prevents module load failures)
		env: {
			OPENAI_API_KEY: 'test-api-key',
			USE_AI: 'false',
			DYNAMODB_COOKBOOKS: 'test-cookbooks-table',
			S3_COOKBOOKS: 'test-cookbooks-bucket',
			AWS_REGION: 'us-east-1',
		},

		// Include test files
		include: ['src/**/*.{test,spec}.{js,ts}', 'tests/**/*.{test,spec}.{js,ts}'],

		// Exclude patterns
		exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],

		// Coverage configuration
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			exclude: [
				'node_modules/',
				'dist/',
				'src/**/*.{test,spec}.ts',
				'**/*.d.ts',
				'vitest.config.ts',
				'esbuild.config.js',
			],
		},

		// Global test timeout (2 minutes for potential async operations)
		testTimeout: 120000,

		// Enable globals (describe, it, expect, etc.)
		globals: true,
	},
});
