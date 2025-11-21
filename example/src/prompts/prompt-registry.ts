import type { RecipeExtractionInput, HeadlineGenerationInput, RecipeExtrasInput } from './types.js';
import type { Provider } from '../agents/models.js';
import chatgptNormV1 from './normalization/chatgpt.v1.js';
import bedrockNormV1 from './normalization/bedrock.v1.js';
import chatgptHeadlineV1 from './generate-headline/chatgpt.v1.js';
import bedrockHeadlineV1 from './generate-headline/bedrock.v1.js';
import chatgptRecipeExtrasV1 from './recipe-extras/chatgpt.v1.js';
import bedrockRecipeExtrasV1 from './recipe-extras/bedrock.v1.js';

export type PromptType = 'recipe-normalization' | 'headline-generation' | 'recipe-extras';
export type PromptVersion = 'v1' | 'v2' | 'v3';

/**
 * Generic prompt definition supporting different input types
 */
export interface PromptDefinition<TInput = unknown> {
  systemPrompt: string;
  userPrompt: (input: TInput) => string;
  functionSchema?: any; // Optional OpenAI function calling schema
}

type PromptRegistry = {
  chatgpt: {
    'recipe-normalization': Partial<Record<PromptVersion, PromptDefinition<RecipeExtractionInput>>>;
    'headline-generation': Partial<Record<PromptVersion, PromptDefinition<HeadlineGenerationInput>>>;
    'recipe-extras': Partial<Record<PromptVersion, PromptDefinition<RecipeExtrasInput>>>;
  };
  bedrock: {
    'recipe-normalization': Partial<Record<PromptVersion, PromptDefinition<RecipeExtractionInput>>>;
    'headline-generation': Partial<Record<PromptVersion, PromptDefinition<HeadlineGenerationInput>>>;
    'recipe-extras': Partial<Record<PromptVersion, PromptDefinition<RecipeExtrasInput>>>;
  };
};

const promptRegistry: PromptRegistry = {
  chatgpt: {
    'recipe-normalization': {
      v1: chatgptNormV1,
    },
    'headline-generation': {
      v1: chatgptHeadlineV1,
    },
    'recipe-extras': {
      v1: chatgptRecipeExtrasV1,
    },
  },
  bedrock: {
    'recipe-normalization': {
      v1: bedrockNormV1,
    },
    'headline-generation': {
      v1: bedrockHeadlineV1,
    },
    'recipe-extras': {
      v1: bedrockRecipeExtrasV1,
    },
  },
};

export const getPrompt = <TInput = unknown>(
  provider: Provider,
  type: PromptType,
  version: PromptVersion
): PromptDefinition<TInput> => {
  const prompt = promptRegistry[provider]?.[type]?.[version];
  if (!prompt) {
    throw new Error(`Prompt not found for provider=${provider}, type=${type}, version=${version}`);
  }
  return prompt as PromptDefinition<TInput>;
};

export const getLatestPrompt = <TInput = unknown>(
  provider: Provider,
  type: PromptType
): PromptDefinition<TInput> => {
  const versions = Object.keys(promptRegistry[provider]?.[type] ?? []) as PromptVersion[];
  if (versions.length === 0) {
    throw new Error(`No prompts available for provider=${provider}, type=${type}`);
  }

  const latest = versions
    .sort((a, b) => parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10))
    .at(-1) as PromptVersion;

  return getPrompt<TInput>(provider, type, latest);
};
