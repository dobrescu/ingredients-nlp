/**
 * Recipe Extras Extraction Module
 *
 * Extracts additional recipe fields from raw HTML fragments
 * using the prompt engine infrastructure.
 *
 * Usage:
 * ```typescript
 * import { RecipeExtrasService } from './prompts/recipe-extras';
 *
 * const service = RecipeExtrasService.create('bedrock');
 * const result = await service.extractExtras({
 *   rawHtml: '<html>...'
 * });
 * ```
 */

export { RecipeExtrasService } from './recipe-extras-service.js';
export { RecipeExtrasSchema, validateRecipeExtrasResponse } from './recipe-extras-schema.js';
export type { RecipeExtrasInput, RecipeExtrasResponse } from './recipe-extras-schema.js';
