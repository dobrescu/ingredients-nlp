import { vi } from 'vitest';
import type { EnhancedRecipePage } from '../../src/types/recipe/recipe.js';

/**
 * Mocks global fetch to return Prepper response
 *
 * @param fixture - EnhancedRecipePage fixture to return
 */
export function mockPrepperResponse(fixture: EnhancedRecipePage) {
	global.fetch = vi.fn((url: string | URL | Request) => {
		const urlString = typeof url === 'string' ? url : url.toString();

		if (urlString.includes('prepper')) {
			return Promise.resolve({
				ok: true,
				status: 200,
				json: () => Promise.resolve(fixture),
			} as Response);
		}

		return Promise.reject(new Error(`Unexpected fetch to: ${urlString}`));
	}) as typeof fetch;
}

/**
 * Mocks Prepper failure response
 *
 * @param errorMessage - Error message to return
 */
export function mockPrepperError(errorMessage: string) {
	global.fetch = vi.fn(() => {
		return Promise.resolve({
			ok: false,
			status: 500,
			json: () => Promise.resolve({ error: errorMessage }),
		} as Response);
	}) as typeof fetch;
}

/**
 * Mocks Prepper timeout
 */
export function mockPrepperTimeout() {
	global.fetch = vi.fn(() => {
		return new Promise((_, reject) => {
			setTimeout(() => reject(new Error('Fetch timeout')), 100);
		});
	}) as typeof fetch;
}
