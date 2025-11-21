---
name: llm-integration-guidelines
description: LLM integration patterns for Chef API using BasePromptService. Use when working with Bedrock/ChatGPT prompts, creating prompt services, AI recipe improvements, or token optimization.
---

# LLM Integration Guidelines - Chef API

## When this skill should be used

Auto-activates when Claude is:

- Creating or modifying prompt service classes
- Working with LLM prompts (Bedrock or ChatGPT)
- Adding AI-powered features
- Implementing token optimization for HTML-heavy content
- Designing prompt engineering strategies
- Configuring model selection

Behavioral rules:

- Never call LLM providers directly - always use BasePromptService subclasses
- Keep prompts concise, focused, schema-driven
- Enforce strict JSON-only output format
- Graceful degradation for all LLM failures (never block main flow)
- Use minification maps for HTML-heavy operations
- Prefer Bedrock for large-token operations unless instructed otherwise

---

## 1. BasePromptService architecture

All LLM integrations extend `BasePromptService`:

```typescript
import { BasePromptService } from '../base-prompt-service.js';
import { Model } from '../../agents/models.js';
import type { YourInput, YourResponse } from './your-schema.js';
import { validateYourResponse } from './your-schema.js';

export class YourPromptService extends BasePromptService<YourInput, YourResponse> {
  constructor(model: Model = Model.BEDROCK_CLAUDE_SONNET_4) {
    super(model, 'your-prompt-type', 'v1');
  }

  async yourMethod(input: YourInput): Promise<YourResponse> {
    if (!input?.requiredField?.trim()) {
      throw new Error('Required field missing');
    }

    const result = await this.executeWithMetrics(input, validateYourResponse);
    return result.data;
  }

  static create(model: Model = Model.BEDROCK_CLAUDE_SONNET_4): YourPromptService {
    return new YourPromptService(model);
  }
}
```

**Key components:**

- `BasePromptService<TInput, TOutput>` - Generic base with metrics, logging, validation
- `Model` enum - Type-safe model selection
- `executeWithMetrics()` - Handles agent calls, validation, timing
- Static `create()` factory - Clean instantiation with default model
- Constructor registers prompt type + version for prompt-registry lookup

**What BasePromptService provides:**

- Automatic provider selection (Bedrock vs ChatGPT) from model
- Prompt loading from prompt-registry
- Metrics collection (execution time, token counts)
- Structured logging with context
- Response validation
- Error propagation (no try-catch - let errors bubble)

---

## 2. Model enum and provider selection

```typescript
import { Model } from '../../agents/models.js';

// Available Bedrock models
Model.BEDROCK_CLAUDE_SONNET_4     // Claude Sonnet 4 (latest, default)
Model.BEDROCK_CLAUDE_3_7_SONNET   // Claude 3.7 Sonnet
Model.BEDROCK_CLAUDE_3_5_SONNET   // Claude 3.5 Sonnet
Model.BEDROCK_CLAUDE_3_5_HAIKU    // Claude 3.5 Haiku (fast, efficient)

// Available ChatGPT models
Model.CHATGPT_GPT4O               // GPT-4o (latest)
Model.CHATGPT_GPT4O_MINI          // GPT-4o-mini (fast, cheap)
Model.CHATGPT_GPT4_TURBO          // GPT-4 Turbo
Model.CHATGPT_GPT35_TURBO         // GPT-3.5 Turbo (legacy)

// Provider automatically inferred from model
getProviderFromModel(Model.BEDROCK_CLAUDE_SONNET_4)  // → 'bedrock'
getProviderFromModel(Model.CHATGPT_GPT4O)             // → 'chatgpt'
```

**Selection guidance:**

- **Bedrock Claude Sonnet 4**: Default for all operations, 200k context, best structured output
- **Bedrock Claude 3.5 Sonnet**: Fallback if Sonnet 4 unavailable
- **ChatGPT GPT-4o**: Alternative provider for testing/comparison
- **ChatGPT GPT-4o-mini**: Fast, cheap, for simple tasks

**When to use Bedrock vs ChatGPT:**

- Bedrock: Large HTML extraction, recipe normalization, token-heavy operations
- ChatGPT: Creative tasks (headlines), quick validations, cost-sensitive operations

---

## 3. Real service examples

### HeadlineGenerationService

```typescript
import { HeadlineGenerationService } from './prompts/generate-headline/index.js';
import { Model } from './agents/models.js';

// Use default model (Bedrock Claude Sonnet 4)
const service = HeadlineGenerationService.create();

const result = await service.generateHeadline({
  name: recipe.name || '',
  description: recipe.description,
});

console.log(result.headline);

// Or specify custom model
const chatGptService = HeadlineGenerationService.create(Model.CHATGPT_GPT4O);
```

### RecipeExtrasService

```typescript
import { RecipeExtrasService } from './prompts/recipe-extras/index.js';

const service = RecipeExtrasService.create();

const result = await service.extractExtras({
  rawHtml: s3Data.fragments.raw.fragment,
  minificationMap: s3Data.plugins.find(p => p.name === 'minify')?.data,
});

console.log(result.extras); // { notes: [...], howToStore: "...", ... }
```

---

## 4. Creating new prompt services

### Step 1: Directory structure

```
src/prompts/your-feature/
├── index.ts                  # Public exports
├── your-feature-service.ts   # Service class (extends BasePromptService)
├── your-feature-schema.ts    # Input/Output types + validation
├── bedrock.v1.ts             # Bedrock prompt definition
└── chatgpt.v1.ts             # ChatGPT prompt definition
```

### Step 2: Schema file

```typescript
// your-feature-schema.ts
export interface YourFeatureInput {
  field1: string;
  field2?: string;
}

export interface YourFeatureResponse {
  result: {
    extractedField: string;
  };
}

export const YourFeatureSchema = {
  type: 'object',
  properties: {
    result: {
      type: 'object',
      properties: {
        extractedField: { type: 'string' }
      },
      required: ['extractedField']
    }
  },
  required: ['result']
};

export function validateYourFeatureResponse(parsed: unknown): YourFeatureResponse {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Response must be an object');
  }

  const response = parsed as Record<string, unknown>;

  if (!response.result || typeof response.result !== 'object') {
    throw new Error('Response.result must be an object');
  }

  const result = response.result as Record<string, unknown>;

  if (typeof result.extractedField !== 'string') {
    throw new Error('extractedField must be a string');
  }

  return parsed as YourFeatureResponse;
}
```

### Step 3: Prompt definition

```typescript
// bedrock.v1.ts
import type { PromptDefinition } from '../prompt-registry.js';
import type { YourFeatureInput } from './your-feature-schema.js';
import { YourFeatureSchema } from './your-feature-schema.js';

const systemPrompt = `Your role and purpose.

Clear, specific instructions about the task.

Respond with valid JSON matching this schema:
${JSON.stringify(YourFeatureSchema, null, 2)}

Example: {"result": {"extractedField": "value"}}

Rules:
- Rule 1
- Rule 2
`.trim();

const userPrompt = (input: YourFeatureInput): string => {
  return `Process this: ${input.field1}`;
};

const bedrockYourFeatureV1: PromptDefinition<YourFeatureInput> = {
  systemPrompt,
  userPrompt,
};

export default bedrockYourFeatureV1;
```

### Step 4: Service class

```typescript
// your-feature-service.ts
import { BasePromptService } from '../base-prompt-service.js';
import { Model } from '../../agents/models.js';
import type { YourFeatureInput, YourFeatureResponse } from './your-feature-schema.js';
import { validateYourFeatureResponse } from './your-feature-schema.js';
import { logger } from '../../utils/logger/logger.js';

export class YourFeatureService extends BasePromptService<
  YourFeatureInput,
  YourFeatureResponse
> {
  constructor(model: Model = Model.BEDROCK_CLAUDE_SONNET_4) {
    super(model, 'your-feature', 'v1');
  }

  async processFeature(input: YourFeatureInput): Promise<YourFeatureResponse> {
    if (!input?.field1?.trim()) {
      throw new Error('Field1 is required');
    }

    logger.info('Processing feature', { field1: input.field1.substring(0, 50) });

    const result = await this.executeWithMetrics(input, validateYourFeatureResponse);

    logger.info('Feature processed', { extractedField: result.data.result.extractedField });
    return result.data;
  }

  static create(model: Model = Model.BEDROCK_CLAUDE_SONNET_4): YourFeatureService {
    return new YourFeatureService(model);
  }
}
```

### Step 5: Register in prompt-registry.ts

```typescript
// Add to prompt-registry.ts
import bedrockYourFeatureV1 from './your-feature/bedrock.v1.js';
import chatgptYourFeatureV1 from './your-feature/chatgpt.v1.js';

export const promptRegistry = {
  bedrock: {
    'your-feature': {
      v1: bedrockYourFeatureV1,
    },
  },
  chatgpt: {
    'your-feature': {
      v1: chatgptYourFeatureV1,
    },
  },
};
```

---

## 5. Token optimization (HTML-heavy content)

**Problem:** Recipe HTML can be 20k-50k tokens, exceeding context limits or costing too much.

**Solution:** Minification maps from Prepper service.

```typescript
// HTML is compressed with stable placeholders
const service = RecipeExtrasService.create();

const result = await service.extractExtras({
  rawHtml: s3Data.fragments.raw.fragment,  // Minified HTML with <ph-123> placeholders
  minificationMap: s3Data.plugins.find(p => p.name === 'minify')?.data,
});

// Service automatically:
// 1. Sends minified HTML to LLM
// 2. LLM extracts data referencing <ph-*> placeholders
// 3. Service restores original URLs using map
```

**Guidelines:**

- Always use minification maps for HTML inputs
- Never send raw HTML >50k tokens without compression
- Document placeholder restoration in prompt if LLM needs to understand structure

---

## 6. Prompt engineering patterns

### Based on headline generation

```typescript
const systemPrompt = `Generate a catchy 5-12 word tagline for a recipe. Focus on what makes it special using sensory, appetizing language. Avoid generic phrases. Complement, don't repeat the recipe name.

Examples:
- "Fluffy, Buttery Layers That Melt in Your Mouth"
- "Bold Flavors Meet Irresistible Crunch"

Respond with valid JSON matching this schema:
${JSON.stringify(HeadlineSchema, null, 2)}

Example: {"headline": "Your Tagline"}`.trim();
```

**Why this works:**

- Clear constraints (5-12 words, sensory language)
- Explicit what NOT to do (no generic phrases, no repetition)
- Examples show desired output style
- Schema embedded in prompt
- JSON-only output enforced

### Based on recipe-extras extraction

**Strong elements:**

- States explicitly what NOT to extract
- Defines structure reconstruction rules for minified HTML
- All fields documented individually
- JSON output with nested structure
- Uses minification map for token reduction

**Key patterns:**

1. **Be explicit about scope:** "Do not re-extract fields already in recipe object"
2. **Handle edge cases:** "If field not found, omit from response"
3. **Structure matters:** "Preserve list order and formatting from HTML"
4. **Schema-driven:** Always include JSON schema in system prompt

---

## 7. Error handling and graceful degradation

See `error-handling-guidelines` skill for comprehensive patterns.

**LLM-specific pattern:**

```typescript
// In handler - optional feature that shouldn't block main flow
if (!recipe.headline && USE_AI) {
  try {
    const headlineService = HeadlineGenerationService.create();
    const result = await headlineService.generateHeadline({
      name: recipe.name || '',
      description: recipe.description,
    });
    recipe.headline = result.headline;
  } catch (error) {
    logger.warn('Headline generation failed', { error });
    // Continue without headline - graceful degradation
  }
}
```

**Key principles:**

- Catch at handler boundary for optional features
- Log warnings (not errors) for failed enhancements
- Never rethrow - let main flow continue
- Service methods let errors bubble (no try-catch inside service)

**For retry logic:** Reference `error-handling-guidelines` skill for retryWithBackoff utility pattern when implementing transient failure handling.

---

## 8. Best practices summary

1. **Architecture**: Always extend BasePromptService, never call LLM APIs directly
2. **Model selection**: Use Model enum for type-safe model configuration
3. **Factory pattern**: Provide static `.create()` method with default model
4. **Validation**: Always validate LLM responses with assertion functions
5. **Prompts**: Keep focused, explicit constraints, JSON-only output
6. **Token optimization**: Use minification maps for HTML >10k tokens
7. **Error handling**: Graceful degradation at handler boundaries, let errors bubble from services
8. **Logging**: Use structured logger with context (prompt type, input size, duration)
9. **Versioning**: Version prompt files (bedrock.v1.ts, chatgpt.v1.ts)
10. **Registration**: Register all prompts in prompt-registry.ts

---

Related skills: `backend-dev-guidelines`, `error-handling-guidelines`, `database-guidelines`

Last updated: 2025-11-20
