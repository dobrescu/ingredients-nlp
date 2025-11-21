/**
 * AI Model definitions with automatic provider inference
 *
 * Usage:
 * ```typescript
 * import { Model, getProviderFromModel, getBedrockArn } from './models';
 *
 * const model = Model.CHATGPT_GPT4O;
 * const provider = getProviderFromModel(model); // 'chatgpt'
 *
 * const bedrockModel = Model.BEDROCK_CLAUDE_SONNET_4;
 * const arn = getBedrockArn(bedrockModel); // Full ARN
 * ```
 */

export enum Model {
	// ChatGPT models - values are OpenAI API model names
	CHATGPT_GPT4O = 'gpt-4o',
	CHATGPT_GPT4O_MINI = 'gpt-4o-mini',
	CHATGPT_GPT4_TURBO = 'gpt-4-turbo',
	CHATGPT_GPT35_TURBO = 'gpt-3.5-turbo',

	// Bedrock Claude models - values are keys for ARN lookup
	BEDROCK_CLAUDE_SONNET_4 = 'claude-sonnet-4',
	BEDROCK_CLAUDE_3_7_SONNET = 'claude-3-7-sonnet',
	BEDROCK_CLAUDE_3_5_SONNET = 'claude-3-5-sonnet',
	BEDROCK_CLAUDE_3_5_HAIKU = 'claude-3-5-haiku',
}

export type Provider = 'chatgpt' | 'bedrock';

/**
 * Bedrock model ARN mapping
 * Maps model enum values to their full inference profile ARNs
 */
const BEDROCK_MODEL_ARNS: Record<string, string> = {
	'claude-sonnet-4': 'arn:aws:bedrock:us-east-1:467241965301:inference-profile/us.anthropic.claude-sonnet-4-20250514-v1:0',
	'claude-3-7-sonnet': 'arn:aws:bedrock:us-east-1:467241965301:inference-profile/us.anthropic.claude-3-7-sonnet-20250219-v1:0',
	'claude-3-5-sonnet': 'arn:aws:bedrock:us-east-1:467241965301:inference-profile/us.anthropic.claude-3-5-sonnet-20241022-v2:0',
	'claude-3-5-haiku': 'arn:aws:bedrock:us-east-1:467241965301:inference-profile/us.anthropic.claude-3-5-haiku-20241022-v1:0',
};

/**
 * Extract provider from model enum
 */
export function getProviderFromModel(model: Model): Provider {
	const modelStr = model.toString();

	if (modelStr.startsWith('gpt-')) {
		return 'chatgpt';
	}

	if (modelStr.startsWith('claude-')) {
		return 'bedrock';
	}

	throw new Error(`Unable to determine provider for model: ${model}`);
}

/**
 * Get Bedrock ARN for a model
 * Only works with Bedrock models
 */
export function getBedrockArn(model: Model): string {
	const provider = getProviderFromModel(model);
	if (provider !== 'bedrock') {
		throw new Error(`Model ${model} is not a Bedrock model`);
	}

	const modelKey = model as string;
	const arn = BEDROCK_MODEL_ARNS[modelKey];

	if (!arn) {
		throw new Error(`No ARN mapping found for Bedrock model: ${model}`);
	}

	return arn;
}

/**
 * Get ChatGPT model string for OpenAI API
 * Only works with ChatGPT models
 */
export function getChatGPTModelString(model: Model): string {
	const provider = getProviderFromModel(model);
	if (provider !== 'chatgpt') {
		throw new Error(`Model ${model} is not a ChatGPT model`);
	}

	return model as string;
}

/**
 * Get default model for a provider
 */
export function getDefaultModelForProvider(provider: Provider): Model {
	switch (provider) {
		case 'chatgpt':
			return DEFAULT_CHATGPT_MODEL;
		case 'bedrock':
			return DEFAULT_BEDROCK_MODEL;
		default:
			throw new Error(`Unknown provider: ${provider}`);
	}
}

/**
 * Default models
 */
export const DEFAULT_CHATGPT_MODEL = Model.CHATGPT_GPT4_TURBO;
export const DEFAULT_BEDROCK_MODEL = Model.BEDROCK_CLAUDE_SONNET_4;
