import { HtmlReplacementService } from '../../services/html-replacement-service.js';
import { BasePromptService } from '../base-prompt-service.js';
import { Model } from '../../agents/models.js';
import type { RecipeExtrasInput, RecipeExtrasResponse } from './recipe-extras-schema.js';
import { validateRecipeExtrasResponse } from './recipe-extras-schema.js';
import { logger } from '../../utils/logger/logger.js';

/**
 * Service for extracting additional recipe fields from raw HTML fragments
 *
 * Usage:
 * ```typescript
 * const service = RecipeExtrasService.create('bedrock');
 * const result = await service.extractExtras({
 *   rawHtml: '<html>...'
 * });
 * console.log(result.extras); // { notes: [...], howToStore: "...", ... }
 * ```
 */
export class RecipeExtrasService extends BasePromptService<
	RecipeExtrasInput,
	RecipeExtrasResponse
> {
	constructor(model: Model = Model.BEDROCK_CLAUDE_SONNET_4) {
		super(model, 'recipe-extras', 'v1');
	}

	async extractExtras(input: RecipeExtrasInput): Promise<RecipeExtrasResponse> {
		if (!input?.rawHtml?.trim() || (!input?.minificationMap)) {
			throw new Error('Raw HTML and minification map are required');
		}

		logger.info('Extracting recipe extras', {
			minificationMapSize: Object.keys(input.minificationMap || {}).length
		});
		const service = new HtmlReplacementService();
		input.rawHtml = service.obfuscate({ rawHtml: input.rawHtml,replaceTags: ['a', 'img']}).transformedHtml
		logger.info('Processing HTML', { htmlSize: input.rawHtml.length });
		const result = await this.executeWithMetrics(input, validateRecipeExtrasResponse);

		const fieldCount = Object.keys(result.data.extras).length;
		logger.info('Extracted recipe extras', { fieldCount });

		return result.data;
	}

	static create(model: Model = Model.BEDROCK_CLAUDE_SONNET_4): RecipeExtrasService {
		return new RecipeExtrasService(model);
	}
}
