---
name: error-handling-guidelines
description: Error handling patterns for Chef API backend. Use when adding try-catch blocks, designing error propagation, logging failures, or deciding between graceful degradation vs hard failure.
---

# Error Handling Guidelines - Chef API

## When this skill should be used

Auto-activates when Claude is:

- Adding or modifying `try-catch` blocks
- Designing error propagation between handlers and services
- Adding error logging
- Implementing graceful degradation for optional features
- Deciding when to catch vs let errors bubble

Behavioral rules:

- Default to minimal try-catch at boundaries only
- Let errors bubble from repositories and services
- Always use shared `logger` with context
- Catch for graceful degradation of optional features
- Never swallow errors silently

---

## 1. Core principle: Minimal try-catch

**Question**: Should every async function have a `try-catch`?
**Answer**: No.

```typescript
// ❌ OVER-ENGINEERED
async function loadRecipe(url: string): Promise<Recipe> {
  try {
    const cached = await getFromCache(url);
    return cached;
  } catch (error) {
    throw error; // Pointless - just rethrowing
  }
}

// ✅ GOOD - Let errors bubble
async function loadRecipe(url: string): Promise<Recipe> {
  const cached = await repository.getRecipe(url);
  if (!cached) {
    throw new Error(`Recipe not found: ${url}`);
  }
  return cached;
}
```

**When to use try-catch**:
1. Lambda handler boundaries (convert to HTTP responses)
2. Graceful degradation (optional features)
3. Adding context before rethrowing

**When NOT to use try-catch**:
1. Middle of call chain (let it bubble)
2. Just to rethrow immediately
3. Repository layer (pure data access)

---

## 2. Error boundaries

### Handler boundary (catch and map to HTTP)

```typescript
export const handleLoadRecipe = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> => {
  const firebaseUID = getFirebaseUID(event);
  if (!firebaseUID) {
    return json(401, { error: 'Unauthorized', code: 'MISSING_AUTH' });
  }

  const body = parseBody<{ url: string }>(event);
  if (!body?.url) {
    return json(400, { error: 'Missing required field: url', code: 'INVALID_REQUEST' });
  }

  try {
    const result = await recipeService.loadRecipe({ url: body.url });
    return json(200, { recipe: result });
  } catch (error) {
    logger.error('Failed to load recipe', { error, url: body.url });
    const message = error instanceof Error ? error.message : String(error);
    return json(500, { error: `Failed to load recipe: ${message}`, code: 'LOAD_FAILED' });
  }
};
```

**Pattern**: Validation → try-catch → service call → HTTP response

---

## 3. Graceful degradation

For optional features that shouldn't break main flow:

```typescript
// Generate headline if missing (optional feature)
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
    // Continue without headline - don't rethrow
  }
}
```

**Use when**:
- Feature improves UX but isn't required
- Failure shouldn't block main operation
- LLM calls for enhancements

---

## 4. Logger usage

Always use shared logger with structured context:

```typescript
import { logger } from './utils/logger/logger.js';

// Info logging
logger.info('Loading recipe for user', { url, urlHash, firebaseUID });

// Warning logging
logger.warn('Cache miss, fetching fresh data', { url });

// Error logging with context
try {
  await recipeService.saveRecipe(recipe);
} catch (error) {
  logger.error('Failed to save recipe', { error, urlHash, firebaseUID });
  const message = error instanceof Error ? error.message : String(error);
  return json(500, { error: `Failed to save recipe: ${message}`, code: 'SAVE_FAILED' });
}
```

**Guidelines**:
- Log once at the boundary where you handle the error
- Include identifiers: `url`, `urlHash`, `firebaseUID`, `operation`
- Pass full `error` object to logger
- Use `error instanceof Error ? error.message : String(error)` for user-facing messages

**Logger API**:
```typescript
logger.info(message, context);
logger.warn(message, context);
logger.error(message, context);
logger.extractMessage(error); // Utility for extracting error message
```

---

## 5. Validation that throws

Use assertion functions that throw instead of returning booleans:

```typescript
function validateManagedRecipe(obj: unknown): asserts obj is ManagedRecipe {
  if (!obj || typeof obj !== 'object') {
    throw new Error('ManagedRecipe must be an object');
  }

  const recipe = obj as Record<string, unknown>;

  const requiredFields = ['urlHash', 'originalUrl', 'createdAt'];
  for (const key of requiredFields) {
    if (typeof recipe[key] !== 'string') {
      throw new Error(`ManagedRecipe.${key} must be a string`);
    }
  }
}

// Usage - throws if invalid
validateManagedRecipe(data);
// TypeScript now knows data is ManagedRecipe
```

**Why**: Simpler control flow, better type inference.

---

## 6. Retry utility (to be implemented)

**Note**: Not yet implemented in codebase. Use when needed for transient failures.

```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        logger.warn('Retrying after error', {
          attempt: attempt + 1,
          maxRetries,
          delay,
          error: lastError.message
        });
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}

// Usage
const recipe = await retryWithBackoff(() => fetchRecipe(url));
```

**When to implement**:
- Transient network errors
- DynamoDB throttling
- S3 temporary failures
- LLM rate limits

**Don't retry**:
- Validation errors
- Not found errors
- Authentication failures

---

## 7. Quick decision guide

```
Should I add try-catch here?

Is this a Lambda handler?            → YES (catch, log, map to HTTP)
Is this an optional feature?         → YES (graceful degradation)
Is this a repository method?         → NO (let errors bubble)
Is this a service method?            → NO (let errors bubble)
Am I just rethrowing immediately?    → NO (remove try-catch)
```

---

## 8. Best practices summary

1. **Catch at boundaries**: Lambda handlers primary, optional features secondary
2. **Let errors bubble**: Repositories and services don't catch
3. **Always log with context**: Use `logger.error(msg, { error, ...ids })`
4. **Graceful degradation**: Optional features must never break core flow
5. **Validation throws**: Use assertion functions, not boolean returns
6. **Error messages**: Include identifiers (url, hash, uid) in logs
7. **Never swallow**: If you catch, either handle or rethrow with context

---

Related skills: `backend-dev-guidelines`, `database-guidelines`, `llm-integration-guidelines`

Last updated: 2025-11-20
