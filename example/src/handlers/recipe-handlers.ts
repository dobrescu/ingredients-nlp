/**
 * Recipe Handlers
 *
 * Route handlers for recipe CRUD operations and LLM improvements
 * Thin layer: validation → service call → response
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { RecipeService } from '../services/recipe-service.js';
import { S3Service } from '../services/s3-service.js';
import { toSimplifiedRecipe, mergeSimplifiedRecipe } from '../mappers/simplified-recipe-mapper.js';
import { wrapRecipe, wrapField } from '../utils/recipe/wrap.js';
import { FIELD_CONFIG } from '../utils/recipe/field-config.js';
import { normalizeUrl, createUrlHash } from '../utils/url-hash.js';
import { HeadlineGenerationService } from '../prompts/generate-headline/index.js';
import { RecipeExtrasService } from '../prompts/recipe-extras/index.js';
import type { SimplifiedRecipe, ManagedRecipe, FieldName } from '../types/recipe/managed-recipe.js';
import type { EnhancedRecipePage } from '../types/recipe/enhanced-recipe-page.js';
import { FragmentType } from '../types/s3.js';
import { logger } from '../utils/logger/logger.js';
import { json } from '../middleware/response.js';
import { getFirebaseUID } from '../middleware/auth.js';
import { parseBody, getPathParam } from '../middleware/request.js';
import { env } from '../env.js';

// Environment constants
const PREPPER_URL = env.PREPPER_URL;
const USE_AI = env.USE_AI;

// Service instances
const recipeService = new RecipeService();
const s3Service = new S3Service();

/**
 * POST /recipe/load - Load recipe from URL
 */
export const handleLoadRecipe = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
	const firebaseUID = getFirebaseUID(event);
	if (!firebaseUID) {
		return json(401, { error: 'Unauthorized', code: 'MISSING_AUTH' });
	}

	const body = parseBody<{ url: string }>(event);
	if (!body?.url) {
		return json(400, { error: 'Missing required field: url', code: 'INVALID_REQUEST' });
	}

	try {
		// Normalize URL and compute hash
		const normalized = normalizeUrl(body.url);
		const urlHash = createUrlHash(normalized);

		logger.info(`Loading recipe for user ${firebaseUID}`, { url: normalized, urlHash });

		// Check shared cache first
		const cachedRecipe = await recipeService.getRecipe(null, urlHash);

		if (cachedRecipe) {
			logger.info('Cache hit - saving to user record', { urlHash, firebaseUID });

			// Save cached recipe to user's record
			await recipeService.saveRecipe(cachedRecipe, 'user', firebaseUID);

			const simplified = toSimplifiedRecipe(cachedRecipe);
			return json(200, { urlHash, recipe: simplified, cached: true });
		}

		// Cache miss - fetch from Prepper
		logger.info('Cache miss - fetching from Prepper', { url: normalized });

		const params = new URLSearchParams({ url: normalized }).toString();
		const response = await fetch(`${PREPPER_URL}/fetch?${params}`, {
			method: 'GET',
			headers: { 'Content-Type': 'application/json' },
		});

		if (!response.ok) {
			const text = await response.text().catch(() => '');
			throw new Error(`Prepper HTTP ${response.status}: ${text}`);
		}

		const prepperData: EnhancedRecipePage = await response.json();

		// Extract recipe from Prepper response
		const recipe = prepperData.recipes?.[0];
		if (!recipe) {
			throw new Error('No recipe found in Prepper response');
		}

		// Generate headline if missing (and USE_AI is enabled)
		if (!recipe.headline && USE_AI) {
			try {
				const headlineService = HeadlineGenerationService.create();
				const headlineResult = await headlineService.generateHeadline({
					name: recipe.name || '',
					description: recipe.description,
				});
				recipe.headline = headlineResult.headline;
			} catch (err) {
				logger.warn('Headline generation failed', { error: err });
			}
		}

		// Wrap fields in ManagedField
		const wrapped = await wrapRecipe(recipe, urlHash, normalized);

		// Save to shared cache (DynamoDB)
		await recipeService.saveRecipe(wrapped, 'shared');

		// Save to user's record (DynamoDB)
		await recipeService.saveRecipe(wrapped, 'user', firebaseUID);

		// Update prepperData with the processed recipe (with headline if generated)
		prepperData.recipes = [recipe];

		// Save complete EnhancedRecipePage to S3 (fragments, plugins, recipes)
		await s3Service.saveRecipe(normalized, prepperData);
		logger.info('Stored complete recipe data to S3 and user record', { url: normalized, firebaseUID });

		logger.info('Recipe loaded and cached', { urlHash });

		const simplified = toSimplifiedRecipe(wrapped);
		return json(200, { urlHash, recipe: simplified, cached: false });
	} catch (error) {
		logger.error('Failed to load recipe', { error, url: body.url });
		const message = error instanceof Error ? error.message : String(error);
		return json(500, { error: `Failed to load recipe: ${message}`, code: 'LOAD_FAILED' });
	}
}

/**
 * GET /recipe/:urlHash - Get recipe with user customizations
 */
export const handleGetRecipe = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
	const firebaseUID = getFirebaseUID(event);
	if (!firebaseUID) {
		return json(401, { error: 'Unauthorized', code: 'MISSING_AUTH' });
	}

	const urlHash = getPathParam(event, 'urlHash');
	if (!urlHash) {
		return json(400, { error: 'Missing urlHash parameter', code: 'INVALID_REQUEST' });
	}

	try {
		logger.info(`Getting recipe for user ${firebaseUID}`, { urlHash });

		// Get recipe (merges user customizations with baseline)
		const recipe = await recipeService.getRecipe(firebaseUID, urlHash);

		if (!recipe) {
			return json(404, { error: 'Recipe not found', code: 'NOT_FOUND' });
		}

		// Convert to SimplifiedRecipe for API response
		const simplified = toSimplifiedRecipe(recipe);

		return json(200, { recipe: simplified });
	} catch (error) {
		logger.error('Failed to get recipe', { error, urlHash, firebaseUID });
		const message = error instanceof Error ? error.message : String(error);
		return json(500, { error: `Failed to get recipe: ${message}`, code: 'GET_FAILED' });
	}
}

/**
 * PUT /recipe/:urlHash - Update recipe with user edits
 */
export const handleUpdateRecipe = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
	const firebaseUID = getFirebaseUID(event);
	if (!firebaseUID) {
		return json(401, { error: 'Unauthorized', code: 'MISSING_AUTH' });
	}

	const urlHash = getPathParam(event, 'urlHash');
	if (!urlHash) {
		return json(400, { error: 'Missing urlHash parameter', code: 'INVALID_REQUEST' });
	}

	const body = parseBody<{ recipe: SimplifiedRecipe }>(event);
	if (!body?.recipe) {
		return json(400, { error: 'Missing required field: recipe', code: 'INVALID_REQUEST' });
	}

	try {
		logger.info(`Updating recipe for user ${firebaseUID}`, { urlHash });

		// Get current recipe (user + baseline merge)
		const current = await recipeService.getRecipe(firebaseUID, urlHash);

		if (!current) {
			return json(404, { error: 'Recipe not found - must load first', code: 'NOT_FOUND' });
		}

		// Merge simplified recipe changes into current recipe
		const { updated, changedFields } = await mergeSimplifiedRecipe(
			current,
			body.recipe,
			firebaseUID
		);

		// Update last modified timestamp
		updated.lastModified = new Date().toISOString();

		// Save to user record (only changed fields)
		if (changedFields.length > 0) {
			await recipeService.saveRecipe(updated, 'user', firebaseUID);
			logger.info('Recipe updated', { urlHash, firebaseUID, changedFields });
		} else {
			logger.info('No fields changed - skipping save', { urlHash, firebaseUID });
		}

		// Return updated recipe
		const simplified = toSimplifiedRecipe(updated);

		return json(200, {
			recipe: simplified,
			changedFields,
		});
	} catch (error) {
		logger.error('Failed to update recipe', { error, urlHash, firebaseUID });
		const message = error instanceof Error ? error.message : String(error);
		return json(500, { error: `Failed to update recipe: ${message}`, code: 'UPDATE_FAILED' });
	}
}

/**
 * POST /recipe/:urlHash/improve - Improve recipe with LLM
 */
export const handleImproveRecipe = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
	const firebaseUID = getFirebaseUID(event);
	if (!firebaseUID) {
		return json(401, { error: 'Unauthorized', code: 'MISSING_AUTH' });
	}

	const urlHash = getPathParam(event, 'urlHash');
	if (!urlHash) {
		return json(400, { error: 'Missing urlHash parameter', code: 'INVALID_REQUEST' });
	}

	if (!USE_AI) {
		return json(400, { error: 'AI features are disabled', code: 'AI_DISABLED' });
	}

	try {
		logger.info(`Improving recipe for user ${firebaseUID}`, { urlHash });

		// Get current recipe
		const current = await recipeService.getRecipe(firebaseUID, urlHash);

		if (!current) {
			return json(404, { error: 'Recipe not found', code: 'NOT_FOUND' });
		}

		// Get raw HTML fragment and plugins from S3
		const s3Data = await s3Service.getRecipe(current.originalUrl, [FragmentType.RAW]);

		if (!s3Data?.fragments?.raw?.fragment) {
			return json(400, {
				error: 'No raw HTML available for improvement',
				code: 'NO_RAW_HTML',
			});
		}

		const rawHtml = s3Data.fragments.raw.fragment;

		// Extract minification map from S3 plugins if available
		// Note: Minification map is for HTML tags (e.g., {"div":"c","h2":"d"})
		// to reduce token count when sending HTML to LLM
		const minifyPlugin = s3Data.plugins?.find((plugin) => plugin.name === 'minify');
		const minificationMap: Record<string, string> = (minifyPlugin?.data as Record<string, string>) || {};

		// Extract extras from raw HTML using LLM
		logger.info('Calling RecipeExtrasService', { urlHash });

		const recipeExtrasService = RecipeExtrasService.create();
		const extrasResult = await recipeExtrasService.extractExtras({
			rawHtml,
			minificationMap,
		});

		const extractedFieldNames: FieldName[] = [];
		const llmModel = 'bedrock'; // TODO: Get from service config
		const promptVersion = 'v1'; // TODO: Get from prompt registry

		// Merge extras into current recipe, preserving user edits
		const improved: ManagedRecipe = { ...current };
		const cachedFields: FieldName[] = [];

		for (const [fieldName, value] of Object.entries(extrasResult.extras)) {
			// Skip null/undefined values
			if (value === null || value === undefined) {
				continue;
			}

			// Check if this is a known editable field
			if (!(fieldName in FIELD_CONFIG)) {
				logger.warn(`Skipping unknown field from LLM: ${fieldName}`);
				continue;
			}

			const typedFieldName = fieldName as FieldName;
			extractedFieldNames.push(typedFieldName);

			// Check if user has edited this field
			const currentField = current[typedFieldName];
			const hasUserEdits =
				currentField &&
				currentField.history.some((entry) => entry.source === 'user');

			if (hasUserEdits) {
				// Skip fields with user edits (preserve user's version)
				logger.info(`Skipping field ${fieldName} - user has edited it`);
				continue;
			}

			// Wrap field with LLM metadata using wrapField
			const renderer = FIELD_CONFIG[typedFieldName].render;
			const rendered = renderer(value);

			const wrappedField = await wrapField(
				value,
				rendered,
				'llm',
				llmModel,
				`Extracted by ${llmModel} using prompt ${promptVersion}`,
				llmModel,
				promptVersion
			);

			// Apply LLM improvement
			// @ts-expect-error: Dynamic field assignment
			improved[typedFieldName] = wrappedField;
			cachedFields.push(typedFieldName);
		}

		// Update lastModified timestamp
		improved.lastModified = new Date().toISOString();

		// Storage routing logic:
		// 1. Always save to user record
		await recipeService.saveRecipe(improved, 'user', firebaseUID);

		// 2. Update shared cache only for fields without user edits
		if (cachedFields.length > 0) {
			// Get or create shared recipe
			const shared = await recipeService.getRecipe(null, urlHash);

			if (shared) {
				// Apply improvements to shared cache for cacheable fields
				const updatedShared: ManagedRecipe = { ...shared };

				for (const fieldName of cachedFields) {
					// @ts-expect-error: Dynamic field assignment
					updatedShared[fieldName] = improved[fieldName];
				}

				updatedShared.lastModified = new Date().toISOString();
				await recipeService.saveRecipe(updatedShared, 'shared');

				logger.info('Updated shared cache', { cachedFields });
			}
		}

		logger.info('Recipe improved', {
			urlHash,
			firebaseUID,
			extractedFields: extractedFieldNames,
			cachedFields,
		});

		const simplified = toSimplifiedRecipe(improved);

		return json(200, {
			extractedFields: extractedFieldNames,
			cachedFields,
			recipe: simplified,
		});
	} catch (error) {
		logger.error('Failed to improve recipe', { error, urlHash, firebaseUID });
		const message = error instanceof Error ? error.message : String(error);
		return json(500, { error: `Failed to improve recipe: ${message}`, code: 'IMPROVE_FAILED' });
	}
}
