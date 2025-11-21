import { BasePromptService } from '../base-prompt-service.js';
import { validateHeadlineResponse } from './headline-schema.js';
import { Model } from '../../agents/models.js';
import type { HeadlineGenerationInput, HeadlineGenerationResponse } from './headline-schema.js';
import { logger } from '../../utils/logger/logger.js';

/**
 * Headline generation service using base prompt engine
 * Extends BasePromptService for clean, reusable architecture
 *
 * @example
 * ```typescript
 * const service = HeadlineGenerationService.create();
 * const result = await service.generateHeadline({
 *   name: "Chocolate Chip Cookies",
 *   description: "Soft, chewy cookies"
 * });
 * ```
 */
export class HeadlineGenerationService extends BasePromptService<
	HeadlineGenerationInput,
	HeadlineGenerationResponse
> {
	constructor(model: Model = Model.BEDROCK_CLAUDE_SONNET_4) {
		super(model, 'headline-generation', 'v1');
	}

	async generateHeadline(input: HeadlineGenerationInput): Promise<HeadlineGenerationResponse> {
		if (!input?.name?.trim()) {
			throw new Error('Recipe name required');
		}

		logger.info('Generating headline', { recipeName: input.name.substring(0, 50) });

		const result = await this.executeWithMetrics(input, validateHeadlineResponse);

		logger.info('Generated headline', { headline: result.data.headline });
		return result.data;
	}

	static create(model: Model = Model.BEDROCK_CLAUDE_SONNET_4): HeadlineGenerationService {
		return new HeadlineGenerationService(model);
	}
}
