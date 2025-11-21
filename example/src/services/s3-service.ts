import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { URLUtils } from '../utils/url-utils.js';
import { logger } from '../utils/logger/logger.js';
import {
	FragmentType,
	S3ErrorType
} from '../types/s3.js';
import type {
	S3SaveRequest,
	S3RetrieveRequest,
	S3RetrieveResponse,
	S3OperationResult,
	FragmentDto,
	PluginDto,
	Plugin
} from '../types/s3.js';
import type { FragmentExcerpt, EnhancedRecipePage } from '../types/index.js';

/**
 * S3 service for recipe data storage and retrieval
 */
export class S3Service {
	private readonly s3Client: S3Client;
	private readonly bucketName: string;

	constructor() {
		this.s3Client = new S3Client({});

		const bucketName = process.env.S3_COOKBOOKS;
		if (!bucketName) {
			throw new Error('S3_COOKBOOKS environment variable is not defined');
		}
		this.bucketName = bucketName;
	}

	/**
	 * Generic method to save JSON data to S3
	 */
	private async saveJsonObject<T>(
		key: string,
		data: T,
		contentType: string = 'application/json'
	): Promise<S3OperationResult<{ key: string }>> {
		try {
			const command = new PutObjectCommand({
				Bucket: this.bucketName,
				Key: key,
				Body: JSON.stringify(data, null, 2),
				ContentType: contentType
			});

			await this.s3Client.send(command);

			return {
				success: true,
				message: `Object saved successfully`,
				data: { key }
			};
		} catch (error) {
			return {
				success: false,
				message: `Failed to save object to ${key}`,
				error: error as Error,
				errorType: S3ErrorType.NETWORK_ERROR
			};
		}
	}

	/**
	 * Save fragment to S3
	 */
	private async saveFragment(
		baseKey: string,
		fragmentType: string,
		data: FragmentExcerpt
	): Promise<S3OperationResult> {
		const fragmentDto: FragmentDto = {
			type: fragmentType as FragmentType,
			data,
			timestamp: new Date().toISOString()
		};

		const key = `${baseKey}/${fragmentType}.json`;
		const result = await this.saveJsonObject(key, fragmentDto);

		return {
			...result,
			message: result.success
				? `Fragment ${fragmentType} saved successfully`
				: `Failed to save fragment ${fragmentType}`
		};
	}

	/**
	 * Save plugin to S3
	 */
	private async savePlugin(
		baseKey: string,
		plugin: Plugin
	): Promise<S3OperationResult> {
		const pluginDto: PluginDto = {
			name: plugin.name,
			data: plugin.data,
			timestamp: new Date().toISOString()
		};

		const key = `${baseKey}/plugins/${plugin.name}.json`;
		const result = await this.saveJsonObject(key, pluginDto);

		return {
			...result,
			message: result.success
				? `Plugin ${plugin.name} saved successfully`
				: `Failed to save plugin ${plugin.name}`
		};
	}

	/**
	 * Save recipe data to S3
	 */
	async saveRecipeData(request: S3SaveRequest): Promise<S3OperationResult> {
		try {
			if (!URLUtils.isValidUrl(request.url)) {
				return {
					success: false,
					message: 'Invalid URL format',
					errorType: S3ErrorType.VALIDATION_ERROR
				};
			}

			const baseKey = URLUtils.generateS3Key(request.url);
			const results: S3OperationResult[] = [];

			// Save fragments in parallel
			const fragmentPromises = Object.entries(request.fragments).map(
				([fragmentType, fragmentData]) =>
					this.saveFragment(baseKey, fragmentType, fragmentData)
			);

			// Save plugins in parallel
			const pluginPromises = request.plugins.map(
				plugin => this.savePlugin(baseKey, plugin)
			);

			const allResults = await Promise.all([...fragmentPromises, ...pluginPromises]);
			results.push(...allResults);

			const failedOperations = results.filter(r => !r.success);

			if (failedOperations.length > 0) {
				return {
					success: false,
					message: `${failedOperations.length} operations failed`,
					data: { results, failed: failedOperations },
					errorType: S3ErrorType.NETWORK_ERROR
				};
			}

			return {
				success: true,
				message: `Successfully saved ${results.length} items to S3`,
				data: { results, baseKey }
			};
		} catch (error) {
			return {
				success: false,
				message: 'Failed to save recipe data',
				error: error as Error,
				errorType: S3ErrorType.UNKNOWN_ERROR
			};
		}
	}

	/**
	 * Generic method to get JSON data from S3
	 */
	private async getJsonObject<T>(key: string): Promise<{
		data: T | null;
		lastModified: string | null;
		error?: S3ErrorType;
	}> {
		try {
			const command = new GetObjectCommand({
				Bucket: this.bucketName,
				Key: key
			});

			const response = await this.s3Client.send(command);

			if (!response.Body) {
				return { data: null, lastModified: null, error: S3ErrorType.NOT_FOUND };
			}

			const bodyString = await response.Body.transformToString();
			const parsedData: T = JSON.parse(bodyString);

			return {
				data: parsedData,
				lastModified: response.LastModified?.toISOString() || null
			};
		} catch (error: any) {
			if (error.name === 'NoSuchKey') {
				return { data: null, lastModified: null, error: S3ErrorType.NOT_FOUND };
			}
			return { data: null, lastModified: null, error: S3ErrorType.NETWORK_ERROR };
		}
	}

	/**
	 * Get fragment from S3
	 */
	private async getFragment(
		baseKey: string,
		fragmentType: string
	): Promise<{ data: FragmentExcerpt | null; lastModified: string | null }> {
		const key = `${baseKey}/${fragmentType}.json`;
		const result = await this.getJsonObject<FragmentDto>(key);

		return {
			data: result.data?.data || null,
			lastModified: result.lastModified
		};
	}

	/**
	 * Get plugin from S3
	 */
	private async getPlugin(
		baseKey: string,
		pluginName: string
	): Promise<Plugin | null> {
		const key = `${baseKey}/plugins/${pluginName}.json`;
		const result = await this.getJsonObject<PluginDto>(key);

		if (!result.data) {
			return null;
		}

		return {
			name: result.data.name,
			data: result.data.data
		};
	}

	/**
	 * Check if data exists in S3 for given URL
	 */
	async dataExists(url: string): Promise<boolean> {
		try {
			const baseKey = URLUtils.generateS3Key(url);

			const command = new ListObjectsV2Command({
				Bucket: this.bucketName,
				Prefix: `${baseKey}/`,
				MaxKeys: 1
			});

			const response = await this.s3Client.send(command);
			return (response.Contents?.length || 0) > 0;
		} catch {
			return false;
		}
	}

	/**
	 * Retrieve recipe data from S3
	 */
	async retrieveRecipeData(request: S3RetrieveRequest): Promise<S3RetrieveResponse> {
		const baseKey = URLUtils.generateS3Key(request.url);
		const fragments: Record<string, FragmentExcerpt> = {};
		const plugins: Plugin[] = [];
		const lastModified: Record<string, string> = {};

		// Determine fragment types to retrieve
		const fragmentTypes = request.fragmentTypes.includes(FragmentType.ALL)
			? Object.values(FragmentType).filter(type => type !== FragmentType.ALL)
			: request.fragmentTypes;

		// Get fragments in parallel
		const fragmentPromises = fragmentTypes.map(async (fragmentType) => {
			const { data, lastModified: lastMod } = await this.getFragment(baseKey, fragmentType);
			if (data) {
				fragments[fragmentType] = data;
				if (lastMod) {
					lastModified[fragmentType] = lastMod;
				}
			}
		});

		await Promise.all(fragmentPromises);

		// Always get plugins
		const availablePlugins = await this.listPlugins(request.url);
		const pluginPromises = availablePlugins.map(pluginName =>
			this.getPlugin(baseKey, pluginName)
		);

		const pluginResults = await Promise.all(pluginPromises);
		plugins.push(...pluginResults.filter((plugin): plugin is Plugin => plugin !== null));

		return {
			url: request.url,
			fragments,
			plugins,
			lastModified
		};
	}

	/**
	 * List available plugins for a URL
	 */
	async listPlugins(url: string): Promise<string[]> {
		try {
			const baseKey = URLUtils.generateS3Key(url);
			const prefix = `${baseKey}/plugins/`;

			const command = new ListObjectsV2Command({
				Bucket: this.bucketName,
				Prefix: prefix
			});

			const response = await this.s3Client.send(command);

			return (response.Contents || [])
				.map(obj => obj.Key)
				.filter((key): key is string => !!key)
				.map(key => key.replace(prefix, '').replace('.json', ''));
		} catch {
			return [];
		}
	}

	/**
	 * Save EnhancedRecipePage to S3 asynchronously (non-blocking)
	 */
	async saveRecipeAsync(url: string, data: EnhancedRecipePage): Promise<void> {
		try {
			const result = await this.saveRecipe(url, data);
			if (result.success) {
				logger.info('S3: Saved recipe', { url });
			}
		} catch (error) {
			logger.error('S3 save failed', { url, error });
		}
	}

	/**
	 * Save EnhancedRecipePage to S3
	 */
	async saveRecipe(url: string, data: EnhancedRecipePage): Promise<S3OperationResult> {
		// Extract fragments safely, filtering out empty values
		const fragments: Record<string, FragmentExcerpt> = {};

		if (data.fragments) {
			Object.entries(data.fragments).forEach(([key, value]) => {
				if (value && value.fragment) { // Only save fragments with actual content
					fragments[key] = value;
				}
			});
		}

		// Only proceed if we have fragments to save
		if (Object.keys(fragments).length === 0) {
			return {
				success: false,
				message: 'No fragments to save',
				errorType: S3ErrorType.VALIDATION_ERROR
			};
		}

		return this.saveRecipeData({
			url,
			fragments,
			plugins: data.plugins || []
		});
	}

	/**
	 * Get recipe data from S3 cache
	 */
	async getRecipe(
		url: string,
		fragmentTypes: FragmentType[] = [FragmentType.ALL]
	): Promise<EnhancedRecipePage | null> {
		if (!URLUtils.isValidUrl(url)) {
			throw new Error(`Invalid URL format: ${url}`);
		}

		try {
			const exists = await this.dataExists(url);
			if (!exists) {
				return null;
			}

			const result = await this.retrieveRecipeData({
				url,
				fragmentTypes
			});

			return {
				url: result.url,
				fragments: result.fragments as any, // Safe since we control the structure
				recipes: undefined, // Would need to be reconstructed from original data if needed
				plugins: result.plugins
			};
		} catch (error) {
			logger.error('Error retrieving recipe from S3', { error });
			return null;
		}
	}

}
