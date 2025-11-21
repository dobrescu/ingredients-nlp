# 7. LLM Integration

**Prerequisites:** [Workflows](./06-workflows.md), [Services](./04-services.md)
**Next:** [Markdown Conversion](./08-markdown-conversion.md)

---

## Overview

The codebase has a **working LLM system** with:
- `src/service.ts::improveRecipe()` - Existing recipe improvement endpoint
- `src/agents/chat-agent-factory.ts` - Model-based agent creation
- `src/prompts/prompt-registry.ts` - Versioned prompt management
- `src/prompts/recipe-extras/` - Extra metadata extraction

**Goal:** Adapt `improveRecipe()` to work with `ManagedRecipe` format.

**Key Prompts:**
- `'headline-generation'` - Runs on load if USE_AI=true, generates catchy headline
- `'recipe-extras'` - **Currently used on /improve endpoint**. Extracts **new fields only** (nutrition, storage, tips, allergens) from raw HTML. Entire recipe + HTML sent to LLM, but only new fields extracted. **Future**: May also improve existing fields.
- `'recipe-normalization'` - Not used yet (future: normalize ingredients/instructions)

**Prompt Field Dependencies:**

Each prompt service must declare which recipe fields it reads from (not which it writes to):

```typescript
abstract class BasePromptService {
  // Fields this prompt depends on (reads from recipe)
  abstract readonly inputFields: FieldName[];

  // Used to determine cache update routing
  // If inputFields overlaps with user's ai-improved/user-edited fields,
  // skip shared cache update (improvement is user-specific)
}
```

**Example declarations:**
- `HeadlineGenerationService`: `inputFields = ['name', 'description']` - reads title and description
- `RecipeExtrasService`: `inputFields = []` - reads only raw HTML, not recipe fields → always updates shared cache
- `RecipeNormalizationService`: `inputFields = ['recipeIngredient', 'recipeInstructions']` - reads to normalize

**USE_AI Flag:**

All prompt services must check `USE_AI` environment variable:
```typescript
if (process.env.USE_AI !== 'true') {
  return { skipped: true, reason: 'USE_AI disabled' };
}
```

---

## Current Implementation

**Existing flow in `improveRecipe(recipeId)`:**

```typescript
export async function improveRecipe(recipeId: string): Promise<UserRecipe> {
  // 1. Get recipe from DynamoDB
  const cachedRecipe = await dynamoService.getRecipeById(recipeId);

  // 2. Get raw HTML from S3
  const s3Data = await s3Service.getRecipe(url, [FragmentType.RAW]);

  // 3. Extract extras using LLM
  const recipeExtrasService = RecipeExtrasService.create();
  const extrasResult = await recipeExtrasService.extractExtras({
    rawHtml: s3Data.fragments.raw.fragment,
    minificationMap: s3Data.plugins.find(p => p.name === 'minify')?.data
  });

  // 4. Merge extras into recipe
  const improvedRecipe = { ...recipe, ...extrasResult.extras };

  // 5. Save back to S3 and DynamoDB
  await s3Service.saveRecipeAsync(url, s3Data);
  await dynamoService.updateRecipe(recipeId, improvedRecipe);

  return improvedRecipe;
}
```

---

## Adaptation for ManagedRecipe

### Key Changes

**1. Input:** Accept full `ManagedRecipe` object (not just recipeId)

**2. Process:** For each field in recipe:
   - Extract current `.value`
   - Build context (source HTML, related fields)
   - Call LLM for improvement
   - Wrap result in `ManagedField<T>` with `source='ai'` and confidence

**3. Output:** Return updated `ManagedRecipe` with improved fields

### Updated Signature

```typescript
export async function improveRecipe(
  urlHash: string,
  firebaseUID: string
): Promise<ManagedRecipe>

// Gets recipe from cache, no need to pass it
```

### Implementation Directions

**Step 1: Get recipe from cache**

```typescript
const recipe = await getRecipe(urlHash, firebaseUID); // Merges user + baseline
```

**Step 2: Get raw HTML from S3**

```typescript
const s3Data = await s3Service.getRecipe(recipe.sourceUrl, [FragmentType.RAW]);
const rawHtml = s3Data.fragments.raw?.fragment;
```

**Step 3: Call recipe-extras prompt**

Use existing `RecipeExtrasService` which handles HTML obfuscation internally:

```typescript
// RecipeExtrasService uses HtmlReplacementService internally to obfuscate <a> and <img> tags
// This minimizes LLM tokens by simplifying HTML: <a href="...long-url...">text</a> → <a href="a-1">text</a>
const recipeExtrasService = RecipeExtrasService.create();
const extrasResult = await recipeExtrasService.extractExtras({
  rawHtml,  // Service handles obfuscation internally
  minificationMap: s3Data.plugins.minify?.data
});
```

**Note:** Token optimization via HTML tag obfuscation is handled internally by `RecipeExtrasService` using `HtmlReplacementService.obfuscate()`. This is already implemented in the current codebase at `src/services/html-replacement-service.ts` and used in `src/prompts/recipe-extras/recipe-extras-service.ts:34`.

**Step 4: Determine cache update routing**

```typescript
const promptService = RecipeExtrasService.create();
const inputFields = promptService.inputFields; // [] for recipe-extras

// Check if any input field was modified by user
const userModifiedInputs = inputFields.some(fieldName => {
  const field = recipe[fieldName];
  return field?.modifications.userModified;
});

const shouldUpdateSharedCache = !userModifiedInputs;
// If inputFields is empty (recipe-extras), always updates shared cache
// If no inputFields have userModified=true, updates shared cache
// If any inputField has userModified=true, skip shared cache
```

**Step 6: Detect changes and store**

```typescript
// For each extracted field from recipe-extras
for (const [fieldName, newValue] of Object.entries(extrasResult.extras)) {
  const currentField = recipe[fieldName];
  const newHash = ContentHashService.hashContent(newValue);

  if (newHash !== currentField?.lastHash) {
    const now = new Date().toISOString();

    const improvedField: ManagedField<any> = {
      value: newValue,
      lastHash: newHash,
      source: 'dynamo',
      modifications: {
        userModified: currentField?.modifications.userModified || false,
        aiModified: true,
        lastModifiedAt: now,
        aiModifiedAt: now,
        userModifiedAt: currentField?.modifications.userModifiedAt
      }
    };

    // ALWAYS update user record
    await dynamoService.updateUserField(firebaseUID, urlHash, fieldName, improvedField);

    // CONDITIONALLY update shared cache:
    // - Only if shouldUpdateSharedCache is true (no user-modified input fields)
    // - AND field was never user-modified
    if (shouldUpdateSharedCache && !currentField?.modifications.userModified) {
      await dynamoService.updateSharedField(urlHash, fieldName, improvedField);
    }
  }
}
```

---

## Prompt Extension

### Add Field Improvement Prompt Type

**File:** `src/prompts/prompt-registry.ts`

```typescript
export type PromptType =
  | 'recipe-normalization'
  | 'headline-generation'
  | 'recipe-extras'
  | 'field-improvement';  // NEW
```

### Create Field Improvement Prompts

**Directory:** `src/prompts/field-improvement/`

```
src/prompts/field-improvement/
├── chatgpt.v1.ts
├── bedrock.v1.ts
└── index.ts
```

**Example:** `bedrock.v1.ts`

```typescript
import type { PromptDefinition } from '../prompt-registry.js';

type FieldImprovementInput = {
  field: string;
  currentValue: any;
  context: {
    sourceUrl: string;
    sourceHtml?: string;
    relatedFields?: Record<string, any>;
  };
};

const systemPrompt = `You are a recipe field improvement specialist.

Analyze the field value and improve:
- Accuracy (match source HTML)
- Clarity (readable, well-formatted)
- Completeness (no missing details)

Respond with JSON:
{
  "improvedValue": <improved value>,
  "reasoning": "brief explanation",
  "confidence": 0.0-1.0
}`;

const userPrompt = (input: FieldImprovementInput): string => `
Field: ${input.field}
Current: ${JSON.stringify(input.currentValue, null, 2)}

Source: ${input.context.sourceUrl}

Improve this field.`;

export default { systemPrompt, userPrompt };
```

**Register in prompt-registry.ts:**

```typescript
import bedrockFieldImprovementV1 from './field-improvement/bedrock.v1.js';

const prompts = {
  // ... existing
  'field-improvement': {
    bedrock: { v1: bedrockFieldImprovementV1 },
    chatgpt: { v1: chatgptFieldImprovementV1 },
  },
};
```

---

## API Endpoint Adaptation

**Current:** `GET /improveRecipe?recipeId=...`

**New:** `POST /api/recipe/:urlHash/improve`

```typescript
app.post('/api/recipe/:urlHash/improve', authenticateFirebase, async (req, res) => {
  const { urlHash } = req.params;
  const { firebaseUID } = req;

  // Get current recipe (merge user + baseline)
  const recipe = await getRecipe(urlHash, firebaseUID);

  // Improve all fields
  const improvedRecipe = await improveRecipe(urlHash, recipe, firebaseUID);

  // Detect changes
  const changedFields = detectChangedFields(recipe, improvedRecipe);

  res.json({
    recipe: improvedRecipe,
    changedFields,
  });
});
```

---

## Error Handling

**Graceful degradation:**

```typescript
async function improveField(field, value, context) {
  try {
    const result = await callLLM(field, value, context);
    return wrapInManagedField(result, 'ai');
  } catch (error) {
    console.error(`Failed to improve ${field}:`, error);
    // Return original value
    return {
      value,
      source: 'manual',
      confidence: 0,
      lastModified: new Date().toISOString(),
    };
  }
}
```

**Parallel improvements:**

```typescript
// Improve all fields in parallel
const improvements = await Promise.allSettled(
  fieldNames.map(field => improveField(field, recipe[field]?.value, context))
);

// Handle partial failures
improvements.forEach((result, i) => {
  if (result.status === 'fulfilled') {
    improvedRecipe[fieldNames[i]] = result.value;
  }
  // else: keep original value
});
```

---

## Summary

**Adaptation steps:**
1. Change `improveRecipe()` to accept full `ManagedRecipe` object
2. Extract field values from `ManagedField<T>` wrappers
3. Call LLM for each field with context
4. Wrap results in `ManagedField<T>` with `source='ai'`
5. Detect changes via content hashing
6. Store only changed fields in user's DynamoDB record

**Key principles:**
- **Reuse existing infrastructure** (prompt-registry, agents, RecipeExtrasService pattern)
- **Single endpoint** (`POST /api/recipe/:urlHash/improve`) for full recipe improvement
- **Graceful fallbacks** (keep original on error)
- **Change detection** (only store what changed)

**Next:** [Markdown Conversion](./08-markdown-conversion.md)
