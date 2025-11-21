---
name: backend-dev-guidelines
description: Backend development patterns for the Chef API using AWS Lambda, API Gateway HTTP APIs (v2), and TypeScript. Use when editing or creating Lambda handlers, API routes, services, repositories, data-access code, or application business logic.
---

# Backend Development Guidelines

## When this skill should be used

Auto-activates when Claude is:

- Editing or creating Lambda handlers or API Gateway routes
- Working on services, repositories, mappers, or business logic
- Integrating with AWS services (DynamoDB, S3, Bedrock)
- Reviewing or refactoring backend code for consistency
- Designing new endpoints or features

Behavioral rules:

- Prefer small, incremental changes over large rewrites
- Preserve existing contracts (types, APIs, database schemas)
- Keep handlers thin - business logic belongs in services
- Always use strict TypeScript
- Catch errors at boundaries, let them bubble internally

---

## 1. Service architecture

### Pattern: Handler → Service → Repository → Data Store

```
Handler     → Thin routing, auth, HTTP mapping
Service     → Business logic, orchestration
Repository  → Data access (DynamoDB, S3)
Mappers     → Convert between domain and storage types
```

**Services** can be classes or stateless functions:

```typescript
// Class-based (current project pattern)
export class RecipeService {
  private readonly repository: RecipeRepository;

  constructor(repository?: RecipeRepository) {
    this.repository = repository || new RecipeRepository();
  }

  async getRecipe(uid: string | null, hash: string): Promise<ManagedRecipe | null> {
    const shared = await this.repository.getSharedRecipe(hash);
    if (!shared) return null;
    // Business logic...
  }
}

// Function-based (simpler cases)
export const calculateScore = (recipe: Recipe): number => {
  // Pure business logic
};
```

**Handlers** should:
- Parse and validate input
- Perform auth checks
- Call services
- Map results to HTTP responses

**Services** should:
- Implement business logic
- Orchestrate repositories
- Remain platform-agnostic (no API Gateway types)

---

## 2. Lambda and API Gateway patterns

### Handler structure (declarative routing)

Current pattern uses `path-to-regexp` for clean routing:

```typescript
import { match } from 'path-to-regexp';

type Route = {
  method: string;
  pattern: string;
  handler: RouteHandler;
};

const routes: Route[] = [
  { method: 'GET', pattern: '/health', handler: async () => handleHealth() },
  { method: 'POST', pattern: '/recipe/load', handler: async (e) => handleLoadRecipe(e) },
  { method: 'GET', pattern: '/recipe/:urlHash', handler: async (e, p) => {
    e.pathParameters = p;
    return handleGetRecipe(e);
  }},
];

export const handler = async (event: APIGatewayProxyEventV2) => {
  const { method, path } = event.requestContext.http;

  if (method === 'OPTIONS') return corsPreflightResponse();

  // Match route
  for (const route of routes) {
    if (route.method !== method) continue;

    const matcher = match(route.pattern, { decode: decodeURIComponent });
    const matched = matcher(path);

    if (matched) {
      return route.handler(event, matched.params);
    }
  }

  // 405 vs 404 handling
  for (const route of routes) {
    const matcher = match(route.pattern);
    if (matcher(path)) return json(405, { error: 'Method Not Allowed' });
  }

  return json(404, { error: 'Not Found' });
};
```

Benefits: declarative routes, automatic path params, proper 405/404 handling.

### Individual route handlers

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
    // Normalize and hash URL
    const normalized = normalizeUrl(body.url);
    const urlHash = createUrlHash(normalized);

    // Check shared cache
    const cachedRecipe = await recipeService.getRecipe(null, urlHash);

    if (cachedRecipe) {
      // Cache hit - save to user's record automatically
      await recipeService.saveRecipe(cachedRecipe, 'user', firebaseUID);
      const simplified = toSimplifiedRecipe(cachedRecipe);
      return json(200, { urlHash, recipe: simplified, cached: true });
    }

    // Cache miss - scrape, wrap, save to both shared cache and user record
    const prepperData = await fetchFromPrepper(normalized);
    const wrapped = await wrapRecipe(prepperData.recipes[0], urlHash, normalized);

    await recipeService.saveRecipe(wrapped, 'shared');
    await recipeService.saveRecipe(wrapped, 'user', firebaseUID);

    const simplified = toSimplifiedRecipe(wrapped);
    return json(200, { urlHash, recipe: simplified, cached: false });
  } catch (error) {
    logger.error('Failed to load recipe', { error, url: body.url });
    const message = error instanceof Error ? error.message : String(error);
    return json(500, { error: `Failed to load recipe: ${message}`, code: 'LOAD_FAILED' });
  }
};
```

**Pattern: auth → validate → service → auto-save to user → response**

**Key behavior:**
- Load recipe ALWAYS saves to user's record automatically
- Returns `urlHash` in response (needed for subsequent updates)
- No separate GET endpoint needed for Kassi - load doubles as get

---

## 3. Authentication (API Gateway v2 JWT authorizer)

API Gateway validates JWT before Lambda runs. Lambda extracts pre-validated claims:

```typescript
export const getFirebaseUID = (event: APIGatewayProxyEventV2): string | null => {
  const requestContext = event.requestContext as any;
  const claims = requestContext.authorizer?.jwt?.claims;
  return (claims?.sub as string) || null;
};
```

Why: JWT validation at API Gateway (infrastructure layer), Lambda only extracts claims. Faster, cheaper, no Firebase SDK needed.

---

## 4. Environment configuration

Centralize and validate environment variables:

```typescript
// src/env.ts
export const env = {
  AWS_REGION: process.env.AWS_REGION ?? 'us-east-1',
  DYNAMODB_TABLE_NAME: process.env.DYNAMODB_TABLE_NAME!,
  S3_BUCKET_NAME: process.env.S3_BUCKET_NAME!,
  PREPPER_URL: process.env.PREPPER_URL || 'http://localhost:9000',
  USE_AI: process.env.USE_AI === 'true',
} as const;

// Validate on module load
if (!env.DYNAMODB_TABLE_NAME) {
  throw new Error('DYNAMODB_TABLE_NAME is required');
}
```

Benefits: fail fast, type-safe, single source of truth.

---

## 5. TypeScript practices

### Strict mode is mandatory

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2020",
    "module": "ESNext"
  }
}
```

### Avoid `any`, prefer `unknown` + validation

```typescript
// ❌ BAD
const processData = (data: any) => data.field;

// ✅ GOOD
const processData = (data: unknown): string => {
  if (typeof data === 'object' && data !== null && 'field' in data) {
    return String((data as any).field);
  }
  throw new Error('Invalid data structure');
};
```

### Clear interfaces

```typescript
interface LoadRecipeParams {
  url: string;
}

interface LoadRecipeResponse {
  recipe: SimplifiedRecipe;
  cached: boolean;
}
```

### Arrow functions (except class methods)

```typescript
export const getFirebaseUID = (event: APIGatewayProxyEventV2): string | null => {
  // Implementation
};
```

### `const` by default, `let` only when necessary

### Explicit return types for exported functions

```typescript
export const json = (
  code: number,
  data: unknown
): APIGatewayProxyStructuredResultV2 => ({
  statusCode: code,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});
```

---

## 6. Error handling

**Core principle**: Catch at boundaries, let errors bubble internally.

See `error-handling-guidelines` skill for comprehensive patterns.

Quick rules:

- Catch at Lambda handlers (always)
- Catch for optional features (graceful degradation)
- Let errors bubble in services (unless adding context)
- Always log with context (uid, hash, url, etc.)
- Use shared `logger` utility

Example:

```typescript
// ✅ Handler boundary
try {
  const recipe = await recipeService.getRecipe(uid, hash);
  return json(200, recipe);
} catch (error) {
  logger.error('Failed to get recipe', { uid, hash, error });
  return json(500, { error: 'Failed to get recipe' });
}

// ✅ Service - let errors bubble
export const getRecipe = async (uid: string, hash: string): Promise<Recipe> => {
  const data = await repository.getRecipe(uid, hash);
  if (!data) throw new Error(`Recipe not found: ${hash}`);
  return data;
};

// ✅ Optional feature - catch locally
try {
  const headline = await headlineService.generate(recipe);
  recipe.headline = headline;
} catch (error) {
  logger.warn('Headline generation failed, continuing', { error });
}
```

---

## 7. AWS service integration

### DynamoDB

- Use `RecipeRepository` or abstraction layer
- Never call DynamoDB client directly from handlers
- See `database-guidelines` skill for detailed patterns

### S3

- Use `S3Service` abstraction
- Separate concerns (upload, download, URL generation)

### LLM / AgentService

- Use prompt service classes (`HeadlineGenerationService`, `RecipeExtrasService`)
- Never call LLM APIs directly
- See `llm-integration-guidelines` skill for detailed patterns

---

## 8. Quick reference

### Common imports

```typescript
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2
} from 'aws-lambda';
import { json } from '../middleware/response.js';
import { getFirebaseUID } from '../middleware/auth.js';
import { parseBody, getPathParam } from '../middleware/request.js';
import { logger } from '../utils/logger/logger.js';
```

### Response helper

```typescript
export const json = (
  code: number,
  data: unknown
): APIGatewayProxyStructuredResultV2 => ({
  statusCode: code,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});
```

---

Related skills: `error-handling-guidelines`, `llm-integration-guidelines`, `database-guidelines`, `recipe-domain-guidelines`

Last updated: 2025-11-20
