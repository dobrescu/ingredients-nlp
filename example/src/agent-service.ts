import { createChatAgent } from './agents/chat-agent-factory.js';
import { Model, getProviderFromModel, type Provider } from './agents/models.js';
import { getPrompt, PromptType, PromptVersion } from './prompts/prompt-registry.js';
import type { RecipeExtractionInput } from './prompts/types.js';
import type { AIResponse } from './agents/chatgpt.js';

export interface AgentServiceConfig {
  model: Model;
  promptType: PromptType;
  promptVersion: PromptVersion;
  enableLogging?: boolean;
  enableTiming?: boolean;
}

export interface ProcessingResult {
  recipe: unknown;
  processingTime: number;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ProcessingMetrics {
  startTime: number;
  endTime: number;
  totalSeconds: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Service responsible for processing recipe data using AI agents
 *
 * This service provides a clean abstraction over AI agent operations, handling:
 * - Chat agent creation and configuration
 * - Prompt execution with proper error handling
 * - Response parsing and validation
 * - Performance metrics collection
 * - Recipe enhancement with media data
 *
 * @example
 * ```typescript
 * const service = new AgentService({
 *   agent: 'chatgpt',
 *   promptType: 'normalization',
 *   promptVersion: 'v1'
 * });
 *
 * const result = await service.processRecipeData(websiteData);
 * console.log(`Processed in ${result.processingTime}s`);
 * ```
 */
export class AgentService {
  private readonly config: Required<AgentServiceConfig>;

  constructor(config: AgentServiceConfig) {
    this.config = {
      enableLogging: true,
      enableTiming: true,
      ...config,
    };
  }

  /**
   * Process recipe data using the configured AI agent
   * @param data - The parsed website data containing HTML, metadata, and plugins
   * @returns Promise<ProcessingResult> - Processed recipe with timing and usage metrics
   * @throws Error if JSON parsing fails or agent processing fails
   */
  async processRecipeData(data: RecipeExtractionInput): Promise<ProcessingResult> {
    this.validateInput(data);

    const metrics = this.startTiming();

    try {
      const provider = getProviderFromModel(this.config.model);
      this.logMessage(`Start asking the agent ${provider} to extract the recipe with parsed content...`);

      // Create chat agent and get prompts
      const chatAgent = createChatAgent(this.config.model);
      const { systemPrompt, userPrompt } = getPrompt(
        provider,
        this.config.promptType,
        this.config.promptVersion
      );

      // Execute AI prompt
      const aiResult = await chatAgent.sendPrompt(systemPrompt, userPrompt(data));
      const aiResponse = this.extractResponseText(aiResult);

      if (!aiResponse || aiResponse.trim().length === 0) {
        throw new Error('AI agent returned empty response');
      }

      // Log raw AI output
      this.logRawOutput(aiResponse);

      // Complete timing and log metrics
      const completedMetrics = this.completeTiming(metrics, aiResult);
      this.logMetrics(completedMetrics);

      // Parse and enhance recipe
      const recipe = this.parseAndEnhanceRecipe(aiResponse, data);

      return {
        recipe,
        processingTime: parseFloat(completedMetrics.totalSeconds),
        usage: completedMetrics.usage,
      };
    } catch (error) {
      const completedMetrics = this.completeTiming(metrics);
      this.logMetrics(completedMetrics);

      if (error instanceof Error) {
        throw new Error(`Agent processing failed: ${error.message}`);
      }
      throw new Error(`Agent processing failed: ${String(error)}`);
    }
  }

  /**
   * Create a new AgentService with different configuration
   * Useful for processing with different agents or prompt versions
   */
  static create(config: AgentServiceConfig): AgentService {
    return new AgentService(config);
  }

  /**
   * Create an AgentService with default ChatGPT configuration
   */
  static createDefault(): AgentService {
    return new AgentService({
      model: Model.BEDROCK_CLAUDE_SONNET_4,
      promptType: 'recipe-normalization',
      promptVersion: 'v1',
    });
  }

  /**
   * Validate the input data structure
   * @param data - The recipe extraction input to validate
   * @throws Error if data is invalid
   */
  private validateInput(data: RecipeExtractionInput): void {
    if (!data) {
      throw new Error('Recipe data is required');
    }

    if (!data.html || typeof data.html !== 'string') {
      throw new Error('Recipe data must contain valid HTML content');
    }

    if (data.plugins && typeof data.plugins !== 'object') {
      throw new Error('Recipe data plugins must be an object or array');
    }
  }

  private startTiming(): ProcessingMetrics {
    return {
      startTime: Date.now(),
      endTime: 0,
      totalSeconds: '0',
    };
  }

  private completeTiming(metrics: ProcessingMetrics, aiResult?: AIResponse | string): ProcessingMetrics {
    const endTime = Date.now();
    const totalSeconds = ((endTime - metrics.startTime) / 1000).toFixed(2);

    let usage;
    if (typeof aiResult !== 'string' && aiResult?.usage) {
      usage = {
        promptTokens: aiResult.usage.promptTokens,
        completionTokens: aiResult.usage.completionTokens,
        totalTokens: aiResult.usage.totalTokens,
      };
    }

    return {
      ...metrics,
      endTime,
      totalSeconds,
      usage,
    };
  }

  private extractResponseText(aiResult: AIResponse | string): string {
    return typeof aiResult === 'string' ? aiResult : aiResult.text;
  }

  private parseAndEnhanceRecipe(aiResponse: string, data: RecipeExtractionInput): unknown {
    try {
      const recipe = JSON.parse(aiResponse) as Record<string, unknown>;

      // Enhance recipe with media data from plugins
      // Handle both array format and plugin object format
      if (Array.isArray(data.plugins)) {
        // Legacy format: array of plugin objects
        recipe.images = (data.plugins as Array<{ name: string; data?: unknown }>)
          .find(p => p.name === 'images')?.data || [];
        recipe.videos = (data.plugins as Array<{ name: string; data?: unknown }>)
          .find(p => p.name === 'videos')?.data || [];
      } else {
        // New format: direct plugin properties
        recipe.images = data.plugins?.images || [];
        recipe.videos = data.plugins?.videos || [];
      }

      return recipe;
    } catch (parseError) {
      throw new Error(`Failed to parse recipe JSON: ${aiResponse}`);
    }
  }

  private logMessage(message: string): void {
    if (this.config.enableLogging) {
      console.log(message);
    }
  }

  private logRawOutput(response: string): void {
    if (this.config.enableLogging) {
      console.log(`==== RAW AI OUTPUT START v0 ====`);
      console.log(response);
      console.log(`==== RAW AI OUTPUT END ====`);
    }
  }

  private logMetrics(metrics: ProcessingMetrics): void {
    if (!this.config.enableTiming) return;

    if (metrics.usage) {
      console.log(
        `⏱ Total time: ${metrics.totalSeconds}s | 🔼 Sent tokens: ${metrics.usage.promptTokens} | 🔽 Received tokens: ${metrics.usage.completionTokens}`
      );
    } else {
      console.log(`⏱ Total time: ${metrics.totalSeconds}s (token usage not available)`);
    }
  }
}
