`# Kassi Integration Guide - Chef API

## Overview

Chef API provides recipe management with automatic scraping, AI improvements, and user customizations. This guide covers how Kassi (the frontend) integrates with the API.

**Base URL:** `https://cook.hautomation.org`

**Authentication:** All endpoints require Firebase JWT token in `Authorization` header.

---

## Authentication

Every request must include a Firebase ID token:

```
Authorization: Bearer <firebase-id-token>
```

The API validates the token at the API Gateway level and extracts the user's Firebase UID automatically.

**Error Response (401 Unauthorized):**
```json
{
  "error": "Unauthorized",
  "code": "MISSING_AUTH"
}
```

---

## Recipe Data Format

### SimplifiedRecipe

Kassi sends and receives recipes in a **flat, markdown-friendly format**:

```typescript
interface SimplifiedRecipe {
  // Recipe URL (source URL from Prepper)
  originalUrl?: string;

  // Text fields (sent/received as strings)
  name?: string;
  description?: string;
  headline?: string;

  // Time fields (ISO 8601 duration, e.g., "PT30M" = 30 minutes)
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;

  // Category fields (sent/received as strings)
  recipeCategory?: string;
  recipeCuisine?: string;
  keywords?: string;
  datePublished?: string;        // ISO 8601 date

  // Yield (sent/received as markdown list)
  recipeYield?: string;          // e.g., "- 4 servings"

  // Ingredients (markdown list)
  recipeIngredient?: string;     // e.g., "- **2 cups** flour\n- 1 tsp salt"

  // Instructions (markdown with sections)
  recipeInstructions?: string;   // e.g., "## Prepare\n\n1. Mix ingredients\n2. Bake"

  // Nutrition object (full object)
  nutrition?: {
    calories?: string;
    proteinContent?: string;
    fatContent?: string;
    carbohydrateContent?: string;
    // ... other nutrition fields
  };

  // Author name (unwrapped, just the name string)
  author?: string;               // e.g., "Chef Example"

  // Image URLs (unwrapped, no @type/@context)
  image?: {
    primaryContentUrl?: string;
    additionalContentUrl?: string[];
  };

  // Video data (unwrapped, no @type/@context)
  video?: {
    name?: string;
    description?: string;
    contentUrl?: string;
    thumbnailUrl?: string[];
  };
}
```

**Key Points:**

- **Text fields** (name, description, headline, etc.): Plain strings
- **List fields** (recipeIngredient, recipeYield): Markdown lists with `- ` prefix
- **Instructions**: Markdown with optional `## Section Name` headers
- **Nutrition**: Full JSON object (as-is from Prepper)
- **Author**: Simple string (just the author name, unwrapped from object)
- **Image/Video**: Unwrapped objects without `@type` or `@context` for cleaner frontend integration
- **All fields are optional** except when creating a new recipe (name is required)
- **aggregateRating** is not included in SimplifiedRecipe (may be added in the future)

---

## API Endpoints

### 1. Load Recipe

**Endpoint:** `POST /recipe/load`

**Purpose:** Load a recipe from a URL. The recipe is automatically saved for the user. If already cached, returns immediately. Otherwise, scrapes the recipe, generates AI improvements (if enabled), and caches it.

**Request:**
```json
{
  "url": "https://example.com/chocolate-chip-cookies"
}
```

**Response (200 OK):**
```json
{
  "urlHash": "abc123def456...",
  "recipe": {
    "originalUrl": "https://example.com/chocolate-chip-cookies",
    "name": "Classic Chocolate Chip Cookies",
    "description": "Delicious homemade cookies with chocolate chips",
    "headline": "Perfect chocolate chip cookies every time",
    "recipeYield": "- 24 cookies",
    "prepTime": "PT15M",
    "cookTime": "PT30M",
    "totalTime": "PT45M",
    "recipeIngredient": "- **2 cups** all-purpose flour\n- **1 tsp** baking soda\n- **1 cup** butter\n- **1 cup** chocolate chips",
    "recipeInstructions": "## Prepare\n\n1. Preheat oven to 350°F\n2. Mix dry ingredients\n\n## Bake\n\n3. Combine wet and dry ingredients\n4. Bake for 12-15 minutes",
    "keywords": "dessert, chocolate, cookies, baking",
    "author": "Chef Example",
    "image": {
      "primaryContentUrl": "https://example.com/cookies.jpg",
      "additionalContentUrl": ["https://example.com/cookies-large.jpg"]
    }
  },
  "cached": false  // true if already in cache, false if freshly scraped
}
```

**Important:**
- Save the `urlHash` - you'll need it for the update endpoint
- The recipe is automatically saved to your user account
- No need to call a separate save/get endpoint

**Workflow:**
1. API normalizes the URL and computes `urlHash` (SHA-256)
2. Checks shared cache for existing recipe
3. If cached: returns immediately, saves to your account
4. If not cached:
   - Calls Prepper service to scrape recipe
   - Generates AI headline (if `USE_AI=true`)
   - Saves to shared cache (DynamoDB)
   - Saves to your user account (DynamoDB)
   - Saves raw HTML to S3 for future AI improvements
   - Returns recipe with urlHash

**Error Codes:**
- `400 INVALID_REQUEST` - Missing or invalid URL
- `401 MISSING_AUTH` - Missing Firebase token
- `500 LOAD_FAILED` - Scraping or processing failed

---

### 2. Update Recipe

**Endpoint:** `PUT /recipe/:urlHash`

**Purpose:** Save user's edits to a recipe. Only changed fields are stored.

**Path Parameters:**
- `urlHash` - SHA-256 hash of the normalized URL (from load response)

**Request:**
```json
{
  "recipe": {
    "name": "My Awesome Cookies",
    "recipeYield": "- 36 cookies",
    "recipeIngredient": "- **3 cups** flour\n- **2 cups** chocolate chips"
  }
}
```

**Important:**
- You only need to send the fields that might have changed
- The API compares hashes to detect actual changes
- Only changed fields are saved to your user record

**Response (200 OK):**
```json
{
  "recipe": {
    "name": "My Awesome Cookies",
    "description": "Delicious homemade cookies with chocolate chips",
    "recipeYield": "- 36 cookies",
    // ... complete recipe with edits applied
  },
  "changedFields": ["name", "recipeYield", "recipeIngredient"]
}
```

**Workflow:**
1. API fetches your current recipe (user edits + baseline merge)
2. Compares incoming SimplifiedRecipe with current version
3. Detects changed fields via content hash comparison
4. Creates history entries with `source: 'user'`
5. Saves only changed fields to your record
6. Returns updated recipe and list of changed fields

**Error Codes:**
- `400 INVALID_REQUEST` - Missing urlHash or recipe body
- `401 MISSING_AUTH` - Missing Firebase token
- `404 NOT_FOUND` - Recipe doesn't exist (must load first)
- `500 UPDATE_FAILED` - Database error

---

## Error Response Format

All errors follow this structure:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE"
}
```

**Common Error Codes:**
- `MISSING_AUTH` - No Firebase token provided
- `INVALID_REQUEST` - Missing or invalid request parameters
- `NOT_FOUND` - Recipe doesn't exist
- `LOAD_FAILED` - Recipe loading failed
- `UPDATE_FAILED` - Recipe update failed

---


## Important Notes

### Automatic User Save

When you call `POST /recipe/load`, the recipe is **automatically saved to your account**. You don't need to call a separate save endpoint. This means:

- First load: Recipe is scraped and saved for you
- Subsequent loads: Your customized version is returned
- No extra API calls needed

### Content Hashing

The API uses SHA-256 content hashing to detect changes. You don't need to worry about this - just send the recipe data and the API handles change detection automatically.

### User Edit Protection

Once you edit a field, AI improvements will **never** overwrite it. The API tracks edit history with sources (`prepper`, `llm`, `user`) and preserves user intent.

### Shared Cache Benefits

When User A loads a recipe, improvements go to shared cache. When User B loads the same recipe URL, they get the improvements instantly (no LLM call, faster response, lower costs). But each user maintains their own copy for customizations.

### Storage Routing

- **Shared cache**: `recipe#<urlHash>` - Baseline recipe, unmodified or AI-improved
- **User record**: `user#<firebaseUID>` - Your customizations

This means:
- Minimal storage per user (only what you changed)
- Fast lookups (one DynamoDB query for load)
- Easy rollback (delete your record to reset to baseline)

### Field Types

When displaying recipes in Kassi:

- **Text fields**: Display as-is
- **List fields**: Render markdown (ingredients, yield, etc.)
- **Instructions**: Render markdown with section headers
- **Object fields**: Display as structured data (nutrition, author, etc.)

When sending updates:

- **Text fields**: Send as plain strings
- **List fields**: Send as markdown lists (with `- ` prefix)
- **Instructions**: Send as markdown
- **Object fields**: Send as JSON objects

---

## CORS

CORS is handled at the API Gateway level. Kassi's origin is whitelisted for all endpoints.

---

## Rate Limiting

Currently no rate limiting. May be added in the future at API Gateway level.

---

## Questions?

For API issues or questions, please ask during the planning phase to eliminate doubts or clarify assumptions
