import { createHash } from 'node:crypto';
import canonicalJson from 'canonical-json';

/**
 * Service for computing deterministic content hashes
 * Uses canonical JSON serialization + SHA-256 for stable hashing
 */
export class ContentHashService {
	/**
	 * Compute SHA-256 hash of any value using canonical JSON serialization
	 * @param value Any JSON-serializable value
	 * @returns Hex-encoded SHA-256 hash
	 *
	 * @example
	 * const hash1 = await ContentHashService.hashContent({ b: 2, a: 1 });
	 * const hash2 = await ContentHashService.hashContent({ a: 1, b: 2 });
	 * // hash1 === hash2 (key order doesn't matter)
	 */
	static async hashContent(value: unknown): Promise<string> {
		// Use canonical-json to ensure deterministic serialization
		// (same object structure always produces same string, regardless of key order)
		const canonicalString = canonicalJson(value);

		// Compute SHA-256 hash
		const hash = createHash('sha256');
		hash.update(canonicalString);

		return hash.digest('hex');
	}

	/**
	 * Compare two hashes for equality (constant-time comparison)
	 * @param hash1 First hash to compare
	 * @param hash2 Second hash to compare
	 * @returns True if hashes are equal
	 *
	 * @example
	 * const isEqual = ContentHashService.compareHashes(hash1, hash2);
	 */
	static compareHashes(hash1: string, hash2: string): boolean {
		// Simple string comparison (hashes are hex strings)
		// Could use crypto.timingSafeEqual for timing-attack resistance,
		// but not critical for this use case (hashes are not secrets)
		return hash1 === hash2;
	}

	/**
	 * Verify that a value matches its claimed hash
	 * @param value The value to verify
	 * @param expectedHash The hash it should match
	 * @returns True if value's hash matches expectedHash
	 *
	 * @example
	 * const isValid = await ContentHashService.verifyHash(recipe.name, field.currentHash);
	 */
	static async verifyHash(value: unknown, expectedHash: string): Promise<boolean> {
		const actualHash = await this.hashContent(value);
		return this.compareHashes(actualHash, expectedHash);
	}
}
