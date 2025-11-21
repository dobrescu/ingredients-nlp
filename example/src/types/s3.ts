import type { FragmentExcerpt } from "./recipe/enhanced-recipe-page";

/**
 * Available fragment types for S3 storage
 */
export enum FragmentType {
	RAW = 'raw',
	NAME = 'name',
	DESCRIPTION = 'description',
	INGREDIENTS = 'ingredients',
	INSTRUCTIONS = 'instructions',
	NUTRITION = 'nutrition',
	ALL = 'all'
}

/**
 * Plugin interface for consistency
 */
export interface Plugin {
	name: string;
	data: unknown;
}

/**
 * Fragment data for S3 storage
 */
export interface FragmentDto {
	type: FragmentType;
	data: FragmentExcerpt;
	timestamp: string;
}

/**
 * Plugin data for S3 storage
 */
export interface PluginDto {
	name: string;
	data: unknown;
	timestamp: string;
}

/**
 * S3 save operation request
 */
export interface S3SaveRequest {
	url: string;
	fragments: Record<string, FragmentExcerpt>;
	plugins: Plugin[];
}

/**
 * S3 retrieve operation request
 */
export interface S3RetrieveRequest {
	url: string;
	fragmentTypes: FragmentType[];
}

/**
 * S3 retrieve operation response
 */
export interface S3RetrieveResponse {
	url: string;
	fragments: Record<string, FragmentExcerpt>;
	plugins: Plugin[];
	lastModified: Record<string, string>;
}

/**
 * S3 operation error types
 */
export enum S3ErrorType {
	NOT_FOUND = 'NOT_FOUND',
	NETWORK_ERROR = 'NETWORK_ERROR',
	VALIDATION_ERROR = 'VALIDATION_ERROR',
	UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * S3 operation result
 */
export interface S3OperationResult<T = unknown> {
	success: boolean;
	message: string;
	data?: T;
	error?: Error;
	errorType?: S3ErrorType;
}
