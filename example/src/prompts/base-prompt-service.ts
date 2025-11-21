import { createChatAgent } from '../agents/chat-agent-factory.js';
import { getPrompt } from './prompt-registry.js';
import type { PromptType, PromptVersion } from './prompt-registry.js';
import type { AIResponse, AIUsage } from '../agents/chatgpt.js';
import { Model, getProviderFromModel, type Provider } from '../agents/models.js';
import { logger } from '../utils/logger/logger.js';

/**
 * Execution metrics for prompt operations
 */
export interface PromptExecutionMetrics {
	promptType: PromptType;
	model: Model;
	provider: Provider;
	processingTime: number;
	usage?: AIUsage;
	success: boolean;
	error?: string;
}

/**
 * Result with both data and metrics
 */
export interface PromptResult<TOutput> {
	data: TOutput;
	metrics: PromptExecutionMetrics;
}

/**
 * Base service for AI prompt execution
 * Provides common engine for all prompt-based services
 *
 * Features:
 * - Agent creation and prompt retrieval
 * - Response extraction and JSON parsing
 * - Comprehensive metrics (timing + token usage)
 * - Formatted status logging
 * - Error handling with context
 *
 * @example
 * ```typescript
 * class MyService extends BasePromptService {
 *   async doSomething(input: MyInput): Promise<MyOutput> {
 *     const result = await this.execute(
 *       input,
 *       (response) => validateMyResponse(response)
 *     );
 *     return result.data;
 *   }
 * }
 * ```
 */
export abstract class BasePromptService<TInput = unknown, TOutput = unknown> {
	protected readonly model: Model;
	protected readonly provider: Provider;
	protected readonly promptType: PromptType;
	protected readonly promptVersion: PromptVersion;

	constructor(
		model: Model,
		promptType: PromptType,
		promptVersion: PromptVersion = 'v1'
	) {
		this.model = model;
		this.provider = getProviderFromModel(model);
		this.promptType = promptType;
		this.promptVersion = promptVersion;
	}

	/**
	 * Execute prompt with agent and validate response
	 * Returns both data and execution metrics
	 */
	protected async executeWithMetrics(
		input: TInput,
		validator: (parsed: unknown) => TOutput
	): Promise<PromptResult<TOutput>> {
		const startTime = Date.now();

		logger.info('Starting prompt execution', { provider: this.provider, promptType: this.promptType });

		try {
			// Use infrastructure: agent factory + prompt registry
			const agent = createChatAgent(this.model);
			const promptDef = getPrompt<TInput>(
				this.provider,
				this.promptType,
				this.promptVersion
			);

			// Execute prompt (ChatGPT can use optional function schema)
			const aiResponse: AIResponse = this.provider === 'chatgpt'
				? await (agent as any).sendPrompt(
						promptDef.systemPrompt,
						promptDef.userPrompt(input),
						promptDef.functionSchema
				  )
				: await agent.sendPrompt(promptDef.systemPrompt, promptDef.userPrompt(input));

			if (!aiResponse.text?.trim()) {
				throw new Error('Empty response from agent');
			}

			logger.info('Received AI response', { responseLength: aiResponse.text.length });
			// Parse and validate
			const data = this.parseAndValidate(aiResponse.text, validator);


			const processingTime = (Date.now() - startTime) / 1000;

			// Log success with metrics
			this.logSuccess(processingTime, aiResponse.usage);

			return {
				data,
				metrics: {
					promptType: this.promptType,
					model: this.model,
					provider: this.provider,
					processingTime,
					usage: aiResponse.usage,
					success: true
				}
			};
		} catch (error) {
			const processingTime = (Date.now() - startTime) / 1000;
			const errorMessage = error instanceof Error ? error.message : String(error);

			// Log failure
			this.logFailure(processingTime, errorMessage);

			throw new Error(
				`[${this.provider.toUpperCase()}] ${this.promptType} failed: ${errorMessage}`
			);
		}
	}

	/**
	 * Execute prompt and return only the data (for backward compatibility)
	 */
	protected async execute(
		input: TInput,
		validator: (parsed: unknown) => TOutput
	): Promise<TOutput> {
		const result = await this.executeWithMetrics(input, validator);
		return result.data;
	}

	/**
	 * Parse JSON response with fallback handling
	 */
private parseAndValidate(text: string, validator: (parsed: unknown) => TOutput): TOutput {
	try {
		// Normalize and trim
		let cleaned = text.trim();

		// Remove markdown code fences or language hints
		cleaned = cleaned
			.replace(/^```(?:json)?\s*/i, '') // remove starting ```json or ```
			.replace(/```$/i, '')             // remove trailing ```
			.trim();

		// Sometimes models prepend or append stray text/comments
		// Try to isolate the first valid JSON object if extra content exists
		const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
		if (jsonMatch) {
			cleaned = jsonMatch[0];
		}

		// Attempt parse
		const parsed = JSON.parse(cleaned);
		return validator(parsed);
	} catch (error) {
		if (error instanceof SyntaxError) {
			logger.warn('JSON parse failed, attempting raw text extraction');
			const cleaned = text.trim().replace(/^["']|["']$/g, '');
			return validator({ text: cleaned });
		}
		throw error;
	}
}


	/**
	 * Log successful execution with metrics
	 */
	private logSuccess(processingTime: number, usage?: AIUsage): void {
		logger.info('Prompt execution completed', {
			provider: this.provider,
			promptType: this.promptType,
			processingTime,
			usage
		});
	}

	/**
	 * Log failed execution
	 */
	private logFailure(processingTime: number, error: string): void {
		logger.error('Prompt execution failed', {
			provider: this.provider,
			promptType: this.promptType,
			processingTime,
			error
		});
	}
}
