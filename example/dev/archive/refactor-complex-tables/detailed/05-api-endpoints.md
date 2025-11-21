# API Endpoints

**Prerequisites:** [Services](./04-services.md)
**Next:** [Workflows](./06-workflows.md)

---

## Purpose

This document provides **high-level directions** for implementing Express API routes with Firebase authentication.

---

## Authentication

**Architecture:** API Gateway HTTP API with JWT Authorizer (no Lambda verification needed).

### API Gateway JWT Authorizer Setup

**Configuration:**
- Issuer URL: `https://securetoken.google.com/<firebase-project-id>`
- Audience: Firebase project ID
- JWT validation: Automatic by API Gateway

**How it works:**
1. Client sends `Authorization: Bearer <firebase-token>` header
2. API Gateway validates JWT signature, issuer, audience, expiration
3. If valid: Forwards request to Lambda with decoded claims
4. If invalid: Returns 401 before Lambda invocation

### Lambda Implementation

**Extract firebaseUID from pre-verified claims:**

```typescript
export const handler = async (event: APIGatewayProxyEventV2) => {
  // API Gateway already verified the token
  const firebaseUID = event.requestContext.authorizer?.jwt?.claims?.sub as string;

  if (!firebaseUID) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  // Use firebaseUID for all operations
  // No Firebase Admin SDK verification needed
};
```

**Key points:**
- Zero Lambda code for JWT verification
- Claims in `event.requestContext.authorizer.jwt.claims`
- `sub` claim = firebaseUID (Firebase user ID)
- 401 automatically returned by API Gateway for invalid tokens

**Reference:** See Premise.md for full API Gateway JWT Authorizer documentation

---

## Route Definitions

### POST /api/recipe/load

**Purpose:** Load recipe from URL (first time or refresh).

**Authentication:** Required (Firebase JWT)

**Request Body:**
```typescript
{
  url: string;  // Recipe URL to scrape
}
```

**Response (200):**
```typescript
{
  recipe: ManagedRecipe;  // Complete wrapped recipe
  cached: boolean;        // True if found in shared cache
}
```

**Error Responses:**
- 400: Missing or invalid URL
- 401: Invalid/missing Firebase token
- 404: Recipe not found at URL (scraping failed)
- 500: Internal error (DynamoDB, S3, scraping)

**Implementation directions:**
1. Validate `url` field exists and is valid HTTP(S) URL
2. Normalize URL (remove query params, trailing slash)
3. Compute `urlHash` = SHA-256 of normalized URL
4. Check shared cache (DynamoDB: `PK=recipe#${urlHash}`, `SK=base`)
5. If found: return cached recipe with `cached: true`
6. If not found:
   - Scrape URL → extract HTML
   - Parse HTML → extract JSON-LD
   - Convert JSON-LD → Markdown → ManagedRecipe (wrap all fields)
   - Store in shared cache (DynamoDB + raw HTML in S3)
   - Return recipe with `cached: false`

**See:** [Workflows](./06-workflows.md) for detailed flow

---

### GET /api/recipe/:urlHash

**Purpose:** Retrieve recipe with user's customizations.

**Authentication:** Required (Firebase JWT)

**URL Parameters:**
- `urlHash` - SHA-256 hash of recipe URL

**Response (200):**
```typescript
{
  recipe: ManagedRecipe;  // Merged user + baseline
}
```

**Error Responses:**
- 401: Invalid/missing Firebase token
- 404: Recipe not found (neither shared cache nor user record exists)
- 500: Internal error

**Implementation directions:**
1. Extract `urlHash` from URL params
2. Extract `firebaseUID` from auth middleware
3. Query user record (DynamoDB: `PK=user#${firebaseUID}`, `SK=recipe#${urlHash}`)
4. Query shared baseline (DynamoDB: `PK=recipe#${urlHash}`, `SK=base`)
5. Merge records:
   - For each field, if user record exists AND field has user history (source='user'), use user's version
   - Otherwise, use shared baseline
6. Return merged `ManagedRecipe`

**See:** [Workflows](./06-workflows.md) for merge logic

---

### PUT /api/recipe/:urlHash

**Purpose:** Update recipe with user edits from Kassi.

**Authentication:** Required (Firebase JWT)

**URL Parameters:**
- `urlHash` - SHA-256 hash of recipe URL

**Request Body:**
```typescript
{
  recipe: SimplifiedRecipe;  // Full recipe with rendered markdown strings (from Kassi)
}
```

**Example Request:**
```json
{
  "recipe": {
    "name": "My Special Chocolate Cake",
    "description": "Updated description with **markdown**",
    "recipeIngredient": "- **3 cups** flour\n- 2 tsp salt\n- 1 tsp espresso powder",
    "recipeInstructions": "## Prepare\n\n1. Mix dry ingredients\n\n## Bake\n\n1. Bake at 350°F for 30 minutes",
    "prepTime": "15 minutes",
    "cookTime": "30 minutes"
  }
}
```

**Response (200):**
```typescript
{
  recipe: SimplifiedRecipe;      // Updated recipe (rendered markdown for Kassi)
  changedFields: FieldName[];    // List of fields that changed
}
```

**Error Responses:**
- 400: Invalid recipe structure, missing fields, validation errors
- 401: Invalid/missing Firebase token
- 404: Recipe not found in shared cache (must load first)
- 500: Internal error

**Implementation directions:**
1. Receive simplified recipe from Kassi (flat object with markdown strings)
2. Parse markdown → JSON-LD for each field (see 08-markdown-conversion.md)
3. Fetch current recipe (user + baseline merge)
4. For each field in request:
   - Wrap in ManagedField with JSON-LD value + rendered markdown
   - Compute hash from JSON-LD value
   - Compare with current field hash
   - If different:
     - Add history entry with `source: 'user'`
     - Mark as changed
5. Store changed fields in user record (DynamoDB: `PK=user#${firebaseUID}`, `SK=recipe#${urlHash}`)
6. Convert ManagedRecipe → SimplifiedRecipe (extract rendered markdown)
7. Return simplified recipe + list of changed field names

**See:** [Workflow 3](./06-workflows.md#workflow-3-user-edit-updaterecipe) and [Kassi Integration](./12-kassi-integration.md)

---

### POST /api/recipe/:urlHash/improve

**Purpose:** Extract additional fields (nutrition, storage, tips, allergens, etc.) from raw HTML via LLM. Reuses cached improvements when possible.

**Current Scope:** Extracts **new fields only** (fields not already populated in the recipe). The entire recipe and raw HTML are sent to the LLM, but currently only new fields are extracted.

**Future Scope:** May also improve/update **existing fields** (e.g., normalize ingredients, enhance instructions) in addition to extracting new ones.

**Authentication:** Required (Firebase JWT)

**URL Parameters:**
- `urlHash` - SHA-256 hash of recipe URL

**Request Body:**
```typescript
// No body required - automatically extracts additional fields
```

**Response (200):**
```typescript
{
  extractedFields: FieldName[];    // Fields newly extracted by LLM
  cachedFields: FieldName[];       // Fields reused from shared cache
  recipe: SimplifiedRecipe;        // Full recipe with improvements (rendered markdown for Kassi)
}
```

**Example Response:**
```json
{
  "extractedFields": ["nutrition", "storage", "tips"],
  "cachedFields": ["allergens"],
  "recipe": {
    "name": "Chocolate Chip Cookies",
    "nutrition": {
      "calories": "210",
      "fatContent": "11g",
      "carbohydrateContent": "27g"
    },
    "storage": "Store in airtight container at room temperature for up to 1 week.",
    "tips": "For chewier cookies, slightly underbake them.",
    "allergens": ["gluten", "dairy", "eggs"]
  }
}
```

**Error Responses:**
- 401: Invalid/missing Firebase token
- 404: Recipe not found
- 500: Internal error (all fields failed)
- 207: Partial success (some fields failed, see `results`)

**Implementation directions:**
1. Fetch current recipe (merge user + baseline) - see Workflow 2
2. Check each extractable field's history for user edits
3. For fields without user history:
   - Check shared cache improvements map using `baseHash`
   - If found: Reuse cached improvement (no LLM call)
4. For fields needing extraction:
   - Fetch raw HTML from S3
   - Extract URLs to placeholders (minimize LLM tokens)
   - Call `RecipeExtrasService.extractExtras()` with transformed HTML
   - Restore URLs in extracted fields
5. Wrap extracted fields in ManagedField with history entries
6. Store improvements:
   - If no user history: Update shared cache improvements map + user record
   - If has user history: Update user record only
7. Return extracted fields, cached fields, and full recipe

**See:** [Workflow 4](./06-workflows.md#workflow-4-improve-recipe-extract-additional-fields-via-llm) and [LLM Integration](./07-llm-integration.md)

---

### GET /api/health

**Purpose:** Health check endpoint.

**Authentication:** None

**Response (200):**
```typescript
{
  status: 'ok';
  timestamp: string;  // ISO 8601
}
```

**Implementation:** Simple static response, no database calls.

---

## Request Validation

**Direction:** Create middleware or helper functions for validation:

### validateRecipeUrl(url: string): boolean
- Check non-empty string
- Check valid HTTP(S) protocol
- Check valid URL format
- Reject localhost, IP addresses (optional security)

### validateRecipeStructure(obj: any): asserts obj is ManagedRecipe
- Use `validateManagedRecipe()` from data models
- Check all required fields present
- Check field types correct
- Throw with field-specific errors

---

## Error Response Format

**Standard error structure:**
```typescript
{
  error: string;        // Human-readable message
  code: string;         // Machine-readable code (e.g., 'INVALID_URL')
  details?: any;        // Additional context (validation errors, etc.)
}
```

**HTTP Status Codes:**
- 200: Success
- 207: Multi-Status (partial success in batch operations)
- 400: Client error (bad request, validation failure)
- 401: Unauthorized (missing/invalid token)
- 404: Not found (recipe doesn't exist)
- 500: Server error (uncaught exceptions, service failures)

---

## Rate Limiting

**Direction:** Implement rate limiting middleware (optional but recommended):
- Per-user limits: e.g., 100 requests/hour for load, 20 requests/hour for improve
- Per-IP limits: e.g., 1000 requests/hour across all endpoints
- Use `express-rate-limit` or similar middleware
- Return 429 (Too Many Requests) when exceeded

---

## Logging

**Direction:** Log key events for observability:
- Request start: method, path, firebaseUID
- Request end: status code, duration
- Errors: full stack trace, request context
- Business events: recipe loaded (cached/new), fields improved (success/failure)
- Use structured logging (JSON format) for easy parsing

**Recommended library:** `winston` or `pino`

---

## CORS Configuration

**Direction:** Configure CORS for Kassi client:
- Allow origin: Kassi's domain (or `*` for development)
- Allow methods: GET, POST, PUT, OPTIONS
- Allow headers: Authorization, Content-Type
- Allow credentials: true (for cookie-based auth if needed)

**Use:** `cors` middleware from Express ecosystem

---

## Deployment Configuration

**Environment Variables:**
- `FIREBASE_PROJECT_ID` - Firebase project identifier
- `DYNAMODB_TABLE_NAME` - Recipe table name
- `S3_BUCKET_NAME` - HTML fragment bucket
- `AWS_REGION` - AWS region for DynamoDB/S3
- `LLM_PROVIDER` - Default provider ('bedrock' or 'chatgpt')
- `BEDROCK_MODEL_ID` - e.g., 'anthropic.claude-3-5-sonnet-20241022-v2:0'
- `OPENAI_API_KEY` - If using ChatGPT (optional)

**Lambda Integration:**
- Export Express app as Lambda handler
- Use `aws-serverless-express` or similar wrapper
- Set Lambda timeout to 60s (for LLM calls)
- Configure VPC if DynamoDB needs private access (usually not required)

---

## Summary

**Four main routes:**
1. **POST /api/recipe/load** - Load/scrape recipe from URL
2. **GET /api/recipe/:urlHash** - Get recipe with user customizations
3. **PUT /api/recipe/:urlHash** - Update recipe with edits
4. **POST /api/recipe/:urlHash/improve** - Batch LLM improvements

**Key middleware:**
- Firebase authentication (all routes except health)
- Request validation (body, params)
- Error handling (consistent format)
- Logging (structured JSON)
- Rate limiting (optional but recommended)

**Next:** [Workflows](./06-workflows.md) for detailed request/response flows.
