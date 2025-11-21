import type { ChatAgent } from './i-chat-agent';
import { Model, getChatGPTModelString, DEFAULT_CHATGPT_MODEL } from './models.js';
import { logger } from '../utils/logger/logger.js';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not defined');

const OPENAI_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0;
const DEFAULT_TIMEOUT_MS = 90_000;

export interface AIUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AIResponse {
  text: string;
  usage: AIUsage;
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIChoice {
  index: number;
  message: {
    role: 'assistant';
    content?: string | null;
    function_call?: {
      name: string;
      arguments: string;
    };
  };
  finish_reason: string;
}

interface OpenAIRawResponse {
  choices: OpenAIChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface ModerationResult {
  flagged: boolean;
  categories: Record<string, boolean>;
  category_scores: Record<string, number>;
}

interface ModerationResponse {
  results: ModerationResult[];
}

/**
 * OpenAI function schema for function calling mode
 */
interface OpenAIFunctionSchema {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

/**
 * OpenAI API request payload
 */
interface OpenAIRequestPayload {
  model: string;
  messages: OpenAIMessage[];
  temperature: number;
  max_tokens: number;
  functions?: OpenAIFunctionSchema[];
  function_call?: { name: string };
}

export class ChatGPTAgent implements ChatAgent {
  private readonly baseUrl = OPENAI_BASE_URL;
  private readonly model: string;
  private readonly headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${OPENAI_API_KEY}`,
  };

  constructor(model: Model = DEFAULT_CHATGPT_MODEL) {
    this.model = getChatGPTModelString(model);
  }

  private handleContentFilter = async (rawChunk: string): Promise<never> => {
    logger.error('ChatGPT content filter triggered', { rawChunk });
    try {
      const resp = await fetch(`${this.baseUrl}/moderations`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ input: rawChunk }),
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });

      if (!resp.ok) {
        logger.error('Moderation API failed', { status: resp.status });
      } else {
        const data: ModerationResponse = await resp.json();
        const result = data.results[0];
        logger.error('Flagged categories', { categories: result.categories });
      }
    } catch (error) {
      logger.error('Moderation check failed', { error });
    }
    throw new Error('OpenAI completion was blocked by content policy (content_filter)');
  };

  private callCompletion = async (
    messages: OpenAIMessage[],
    functionSchema?: OpenAIFunctionSchema
  ): Promise<{ raw: string; text: string; usage: AIUsage; finishReason: string }> => {
    const payload: OpenAIRequestPayload = {
      model: this.model,
      messages,
      temperature: DEFAULT_TEMPERATURE,
      max_tokens: DEFAULT_MAX_TOKENS,
    };

    // Add function calling if schema provided
    if (functionSchema) {
      payload.functions = [functionSchema];
      payload.function_call = { name: functionSchema.name };
    }

    const resp = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`HTTP ${resp.status} ${resp.statusText}: ${errText}`);
    }

    const data: OpenAIRawResponse = await resp.json();
    const choice = data.choices?.[0];
    if (!choice) throw new Error('OpenAI returned no choices');

    let raw: string;
    let text: string;

    if (functionSchema) {
      // Function calling mode
      const funcCall = choice.message.function_call;
      if (!funcCall?.arguments) throw new Error('No function call arguments returned');
      raw = funcCall.arguments;
      text = raw;
    } else {
      // Regular chat completion
      const content = choice.message.content;
      if (!content) throw new Error('No content in response');
      raw = content;
      text = content;
    }

    const finishReason = choice.finish_reason;

    if (finishReason === 'content_filter') {
      await this.handleContentFilter(raw);
    }

    const { prompt_tokens, completion_tokens, total_tokens } = data.usage;
    const usage: AIUsage = {
      promptTokens: prompt_tokens,
      completionTokens: completion_tokens,
      totalTokens: total_tokens,
    };

    return { raw, text, usage, finishReason };
  };

  public sendPrompt = async (systemPrompt: string, userPrompt: string, functionSchema?: OpenAIFunctionSchema): Promise<AIResponse> => {
    const initialMessages: OpenAIMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    let messages = [...initialMessages];
    let aggregatedText = '';
    let aggregatedUsage: AIUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    let finishReason: string;

    do {
      const result = await this.callCompletion(messages, functionSchema);
      const { text, usage, finishReason: reason } = result;
      finishReason = reason;

      if (!aggregatedUsage.promptTokens) aggregatedUsage.promptTokens = usage.promptTokens;
      aggregatedUsage.completionTokens += usage.completionTokens;
      aggregatedUsage.totalTokens += usage.totalTokens;

      aggregatedText += text;

      if (finishReason === 'length') {
        messages = [
          ...initialMessages,
          { role: 'assistant', content: aggregatedText },
          { role: 'user', content: 'Please continue from where you left off.' },
        ];
      }
    } while (finishReason === 'length');

    return { text: aggregatedText, usage: aggregatedUsage };
  };
}
