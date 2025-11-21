import { createHash } from 'crypto';

/**
 * Normalizes a URL for consistent hashing
 * @param url - The URL to normalize
 * @returns Normalized URL string
 */
export const normalizeUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);

    // Normalize protocol to https
    urlObj.protocol = 'https:';

    // Remove trailing slash
    urlObj.pathname = urlObj.pathname.replace(/\/$/, '');

    // Sort query parameters
    const sortedParams = new URLSearchParams();
    [...urlObj.searchParams.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([key, value]) => sortedParams.append(key, value));

    urlObj.search = sortedParams.toString();

    // Remove fragment
    urlObj.hash = '';

    return urlObj.toString().toLowerCase();
  } catch {
    // If URL parsing fails, return the original string normalized
    return url.trim().toLowerCase();
  }
};

/**
 * Creates a deterministic hash from a URL
 * @param url - The URL to hash
 * @returns SHA-256 hash string
 */
export const createUrlHash = (url: string): string => {
  const normalizedUrl = normalizeUrl(url);
  return createHash('sha256').update(normalizedUrl).digest('hex');
};

/**
 * Validates if a string is a valid URL hash (64 char hex)
 * @param hash - The hash to validate
 * @returns True if valid URL hash
 */
export const isValidUrlHash = (hash: string): boolean => {
  return /^[a-f0-9]{64}$/i.test(hash);
};

/**
 * Creates DynamoDB partition key from URL
 * @param url - The URL to create key for
 * @returns Partition key in format URL#{hash}
 */
export const createUrlPartitionKey = (url: string): string => {
  const hash = createUrlHash(url);
  return `URL|${hash}`;
};
