import { vi, beforeEach } from 'vitest';
import { setupMocks } from './helpers.js';

// Mock logger globally to suppress output in tests
vi.mock('../src/utils/logger/logger.js', () => ({
	logger: {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
		extractMessage: (error: unknown): string => {
			if (error instanceof Error) return error.message;
			if (typeof error === 'string') return error;
			return String(error);
		},
	},
}));

// Setup AWS service mocks and clear before each test
beforeEach(() => {
	vi.clearAllMocks();
	setupMocks();
});
