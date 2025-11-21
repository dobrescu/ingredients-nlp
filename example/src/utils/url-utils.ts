/**
 * URL utilities for S3 path generation and validation
 */
export class URLUtils {
	/**
	 * Validate if a string is a valid URL
	 */
	static isValidUrl(url: string): boolean {
		try {
			new URL(url);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Generate S3-safe path from URL
	 */
	static generateS3Path(url: string): { domain: string; path: string; fileName: string } {
		if (!this.isValidUrl(url)) {
			throw new Error(`Invalid URL format: ${url}`);
		}

		const urlObj = new URL(url);
		const domain = urlObj.hostname;
		let path = urlObj.pathname;

		// Include query parameters in the path
		if (urlObj.search) {
			path += urlObj.search.replace(/[?&]/g, '_').replace(/=/g, '-');
		}

		// Clean up path - remove leading/trailing slashes and replace problematic characters
		path = path.replace(/^\/+|\/+$/g, '').replace(/[\/]/g, '_').replace(/[^a-zA-Z0-9\-_]/g, '_');

		// Generate filename from path or use 'index' as default
		const fileName = path || 'index';

		return { domain, path, fileName };
	}

	/**
	 * Generate full S3 key from URL
	 */
	static generateS3Key(url: string): string {
		const { domain, fileName } = this.generateS3Path(url);
		const key = `web/${domain}/${fileName}`;

		// AWS S3 key length limit is 1024 characters
		if (key.length > 1024) {
			throw new Error(`Generated S3 key too long (${key.length} > 1024): ${key.substring(0, 100)}...`);
		}

		return key;
	}
}

/**
 * Fragment type validation utilities
 */
export class FragmentUtils {
	/**
	 * Validate if a string is a valid FragmentType
	 */
	static isValidFragmentType(type: string): boolean {
		return Object.values(FragmentType).includes(type as FragmentType);
	}

	/**
	 * Get all fragment types except ALL
	 */
	static getAllFragmentTypes(): FragmentType[] {
		return Object.values(FragmentType).filter(type => type !== FragmentType.ALL);
	}
}

// Import needed for FragmentType
import { FragmentType } from '../types/s3.js';
