# Data Models

**Prerequisites:** [Overview](./01-overview.md)
**Next:** [Database Schema](./03-database-schema.md)

---

## Purpose

This document provides **directions** for implementing TypeScript interfaces for the Lightweight Field Envelope solution. Actual code will be written during implementation phase.

---

## Core Types

### ManagedField<T>

**Purpose:** Wrapper for every recipe field to enable change tracking, storage routing, and observability.

**Structure to implement:**
- Generic interface `ManagedField<T>` where T is the wrapped value type

**Core Data:**
- `value: T` - JSON-LD canonical structure (source of truth for hashing, persistence, AI)
- `rendered: RenderedContent` - Display representation (markdown for Kassi)

**Identity & Lineage:**
- `currentHash: string` - SHA-256 hex hash of `value` for change detection
- `baseHash: string` - Hash of original unimproved version (enables improvement reuse)

**History:**
- `history: HistoryEntry[]` - Edit history tracking all modifications
- **Pruning strategy:** Keep last 20 entries in DynamoDB (automatic pruning on each update)
- Each entry is ~200-250 bytes (only metadata, no content duplication)
- 20 entries × 250 bytes = ~5KB per field (well within DynamoDB limits)

**RenderedContent interface:**
```typescript
interface RenderedContent {
  type: 'markdown' | 'html' | 'text' | 'rich';  // Format type
  value: string;                                  // Rendered content
  version: string;                                // Renderer version (e.g., "1.0.0")
  ref?: string;                                   // Optional S3 reference if stored externally
}
```

**HistoryEntry interface:**
```typescript
interface HistoryEntry {
  timestamp: string;           // ISO 8601
  hash: string;                // Content hash at this point
  source: 'prepper' | 'llm' | 'user';
  actor?: string;              // firebaseUID or 'system'
  llmModel?: string;           // e.g., "claude-3-5-sonnet" (if source='llm')
  promptVersion?: string;      // e.g., "v1.2.0" (if source='llm')
  summary: string;             // "Initial ingestion" | "User edited" | "AI extracted field"
}
```

**Derived Properties** (computed from history, not stored):
- `isUserEdited`: True if any history entry has `source === 'user'`
- `isAiImproved`: True if any history entry has `source === 'llm'`
- `lastModifiedAt`: Last history entry timestamp
- `lastModifiedBy`: Last history entry actor

**Design considerations:**
- Cache update routing: Only update shared cache if `!isUserEdited` (no user history entries)
- `currentHash` enables O(1) change detection
- `baseHash` enables improvement reuse (check if another user improved this base)
- History provides full audit trail without redundant flags
- `rendered` can be regenerated if `rendered.version` differs from current renderer version

**BaseHash Rules:**
1. **Set once** when field first created from Prepper (equals `currentHash` initially)
2. **Never changes**, even after AI improvements or user edits
3. **Used as lookup key** for shared improvement cache (enables reuse across users)
4. **Purpose**: Enables question "Has anyone else already improved this same base content?"

**Example usage patterns:**
```typescript
// Never touched (base from Prepper)
const baseField: ManagedField<string> = {
  value: "Chocolate Cake",
  rendered: {
    type: "markdown",
    value: "Chocolate Cake",
    version: "1.0.0"
  },
  currentHash: "a3f9...",
  baseHash: "a3f9...",  // Same as currentHash
  history: [
    {
      timestamp: "2025-01-15T10:00:00Z",
      hash: "a3f9...",
      source: "prepper",
      actor: "system",
      summary: "Initial ingestion from recipe webpage"
    }
  ]
};

// AI improved only
const aiField: ManagedField<{ calories: string }> = {
  value: { calories: "450" },
  rendered: {
    type: "markdown",
    value: "**Calories:** 450 per serving",
    version: "1.0.0"
  },
  currentHash: "b4e2...",
  baseHash: "a3f9...",  // Links to original (before AI)
  history: [
    {
      timestamp: "2025-01-15T10:00:00Z",
      hash: "a3f9...",
      source: "prepper",
      actor: "system",
      summary: "Initial ingestion (no nutrition data)"
    },
    {
      timestamp: "2025-01-15T11:00:00Z",
      hash: "b4e2...",
      source: "llm",
      actor: "system",
      llmModel: "claude-3-5-sonnet-20241022",
      promptVersion: "recipe-extras-v1.2.0",
      summary: "AI extracted nutrition from raw HTML"
    }
  ]
};

// User edited only
const userField: ManagedField<string> = {
  value: "My Special Cake",
  rendered: {
    type: "markdown",
    value: "My Special Cake",
    version: "1.0.0"
  },
  currentHash: "c5d3...",
  baseHash: "a3f9...",  // Links to original
  history: [
    {
      timestamp: "2025-01-15T10:00:00Z",
      hash: "a3f9...",
      source: "prepper",
      actor: "system",
      summary: "Initial ingestion"
    },
    {
      timestamp: "2025-01-15T12:00:00Z",
      hash: "c5d3...",
      source: "user",
      actor: "user123abc",
      summary: "User edited recipe name"
    }
  ]
};

// AI improved, THEN user edited (both in history)
const bothField: ManagedField<string[]> = {
  value: ["3 cups flour", "2 tsp salt", "1 tsp espresso powder"],
  rendered: {
    type: "markdown",
    value: "- **3 cups** flour\n- 2 tsp salt\n- 1 tsp espresso powder",
    version: "1.0.0"
  },
  currentHash: "d7f4...",
  baseHash: "a3f9...",
  history: [
    {
      timestamp: "2025-01-15T10:00:00Z",
      hash: "a3f9...",
      source: "prepper",
      summary: "Initial ingestion"
    },
    {
      timestamp: "2025-01-15T11:00:00Z",
      hash: "b4e2...",
      source: "llm",
      llmModel: "claude-3-5-sonnet-20241022",
      promptVersion: "recipe-extras-v1.0.0",
      summary: "AI normalized ingredient format"
    },
    {
      timestamp: "2025-01-15T13:00:00Z",
      hash: "d7f4...",
      source: "user",
      actor: "user123abc",
      summary: "User added espresso powder ingredient"
    }
  ]
};

// Derived properties (computed on-demand):
console.log(bothField.isUserEdited);  // true (has source='user' entry)
console.log(bothField.isAiImproved);  // true (has source='llm' entry)
console.log(bothField.lastModifiedAt); // "2025-01-15T13:00:00Z" (last history entry)
console.log(bothField.lastModifiedBy); // "user123abc" (last history entry actor)
```

**Benefits of history-based approach:**
- Single source of truth (no redundant flags to sync)
- Full observability (can see exactly what changed when)
- LLM model/prompt tracking for debugging
- Can prune old entries to manage storage (keep last N)

---

### ManagedRecipe

**Purpose:** Complete recipe with all editable fields wrapped in `ManagedField<T>`.

**Structure to implement:**
- Main interface `ManagedRecipe` matching schema.org/Recipe structure
- **Non-wrapped metadata section:**
  - `urlHash: string` - SHA-256 of normalized URL
  - `originalUrl: string` - Source URL
  - `createdAt: string` - ISO 8601 timestamp
  - `lastModified: string` - ISO 8601 timestamp
  - `schemaVersion: string` - e.g., "1.0.0"

- **Wrapped editable fields** (all use `ManagedField<T>`):
  - `name: ManagedField<string>` - Recipe title
  - `description: ManagedField<string>` - Short summary
  - `recipeYield: ManagedField<string>` - e.g., "4 servings"
  - `totalTime: ManagedField<string>` - ISO 8601 duration, e.g., "PT45M"
  - `recipeIngredient: ManagedField<string[]>` - Ingredient list
  - `recipeInstructions: ManagedField<RecipeInstruction[]>` - Step-by-step
  - `recipeCategory: ManagedField<string[]>` - Cuisine types
  - `keywords: ManagedField<string[]>` - Searchable tags
  - `image: ManagedField<string | ImageObject>` - Image URL or object
  - `author: ManagedField<Person | Organization>` - Creator info
  - `aggregateRating: ManagedField<AggregateRating | null>` - Reviews
  - `nutrition: ManagedField<NutritionInformation | null>` - Nutritional data

**Design considerations:**
- `metadata` never wrapped (system-managed, not user-editable)
- All editable fields consistently wrapped for uniform handling
- Field types match schema.org/Recipe specification
- Each field tracks its own `rendered.version` (enables per-field re-conversion if markdown logic changes)
- `value` stores JSON-LD canonical structure (hashed for change detection)
- `rendered.value` stores markdown representation (sent to Kassi)

---

### Supporting Types (Schema.org)

**Direction:** Create interfaces matching schema.org definitions:

**RecipeInstruction** (HowToStep):
- `@type: "HowToStep"`
- `text: string` (required)
- `name?: string` (optional step heading)
- `image?: string` (optional illustration)

**ImageObject:**
- `@type: "ImageObject"`
- `url: string`
- `width?: number`, `height?: number`, `caption?: string`

**Person / Organization:**
- `@type: "Person" | "Organization"`
- `name: string`
- `url?: string`

**AggregateRating:**
- `@type: "AggregateRating"`
- `ratingValue: number`, `ratingCount: number`
- `bestRating?: number`, `worstRating?: number`

**NutritionInformation:**
- `@type: "NutritionInformation"`
- Optional fields: `calories`, `carbohydrateContent`, `proteinContent`, `fatContent`, `fiberContent`, `sugarContent`, `sodiumContent`, `servingSize` (all strings)

---

## Storage Types

### StoredRecipe (DynamoDB)

**Purpose:** Flattened format for DynamoDB storage.

**Structure to implement:**
- Interface `StoredRecipe` with:
  - `PK: string` - Partition key
  - `SK: string` - Sort key
  - `urlHash: string` - For indexing
  - `originalUrl: string` - Source URL
  - `createdAt: string` - ISO 8601 timestamp
  - `lastModified: string` - ISO 8601 timestamp
  - `schemaVersion: string` - e.g., "1.0.0"
  - `fields: Record<string, string>` - Map of field name → JSON-stringified `ManagedField`

**Design considerations:**
- Store `ManagedField` objects as JSON strings to avoid DynamoDB nested type limitations
- Partition key patterns:
  - Shared cache: `PK=recipe#<urlHash>`, `SK=base`
  - User record: `PK=user#<firebaseUID>`, `SK=recipe#<urlHash>`
- See [Database Schema](./03-database-schema.md) for full query patterns

**Example structure:**
```json
{
  "PK": "recipe#a3f9d2...",
  "SK": "base",
  "urlHash": "a3f9d2...",
  "originalUrl": "https://example.com/recipe",
  "createdAt": "2025-01-15T10:00:00Z",
  "lastModified": "2025-01-15T10:00:00Z",
  "schemaVersion": "1.0.0",
  "fields": {
    "name": "{\"value\":\"Cake\",\"rendered\":{\"type\":\"markdown\",\"value\":\"Cake\",\"version\":\"1.0.0\"},\"currentHash\":\"a3f9...\",\"baseHash\":\"a3f9...\",\"history\":[{\"timestamp\":\"2025-01-15T10:00:00Z\",\"hash\":\"a3f9...\",\"source\":\"prepper\",\"actor\":\"system\",\"summary\":\"Initial ingestion from recipe webpage\"}]}"
  }
}
```

---

## Helper Types

### FieldName

**Purpose:** Type-safe enumeration of valid recipe field names.

**Direction:** Create union type with these literal values:
- `'name' | 'description' | 'recipeYield' | 'totalTime' | 'recipeIngredient' | 'recipeInstructions' | 'recipeCategory' | 'keywords' | 'image' | 'author' | 'aggregateRating' | 'nutrition'`

**Additional helper:** Create type guard function `isFieldName(key: string): key is FieldName` for runtime validation.

---

### SimplifiedRecipe

**Purpose:** Flat recipe object with rendered markdown strings sent to/from Kassi (React Native app).

**Structure to implement:**
- Interface with all recipe field names mapped to **rendered values only**
- Text fields: `string` (markdown formatting allowed: `**bold**`, `_italic_`, `[links](url)`)
- List fields: `string` (markdown bullet lists: `"- item1\n- item2"`)
- Structured fields: `string` (markdown with headings: `"## Section\n\n1. Step"`)
- Object fields: Nested objects (nutrition, author, image, aggregateRating)

**Key characteristics:**
- **No ManagedField wrappers** - Kassi sees only the rendered content
- **No metadata** - No hashes, history, or internal tracking
- **Flat structure** - Easy to work with in React Native
- **Bidirectional** - Same format for GET and PUT requests

**Example:**
```typescript
interface SimplifiedRecipe {
  name?: string;
  description?: string;
  recipeYield?: string;
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  recipeCategory?: string;
  recipeCuisine?: string;
  keywords?: string;

  // List fields as markdown
  recipeIngredient?: string;  // "- **2 cups** flour\n- 1 tsp salt"

  // Structured fields as markdown
  recipeInstructions?: string;  // "## Prepare\n\n1. Mix ingredients\n\n## Bake\n\n1. Bake at 350°F"

  // Object fields
  nutrition?: NutritionInformation;
  author?: Person | Organization;
  image?: string | ImageObject;
  aggregateRating?: AggregateRating;
}
```

**Usage:**
- **Chef → Kassi**: Extract `rendered.value` from each `ManagedField`
- **Kassi → Chef**: Parse markdown back to JSON-LD, wrap in `ManagedField`

**See:** [Kassi Integration](./12-kassi-integration.md) for detailed contract.

---

### ImprovementRequest

**Purpose:** Request payload for batch LLM improvements.

**Structure to implement:**
- `firebaseUID: string` - User identifier
- `urlHash: string` - Recipe identifier
- `fieldNames: FieldName[]` - Fields to improve (processed in parallel)
- `provider?: 'bedrock' | 'chatgpt'` - LLM provider (default: bedrock)

**Example:**
```json
{
  "firebaseUID": "abc123",
  "urlHash": "def456",
  "fieldNames": ["name", "description", "recipeInstructions"],
  "provider": "bedrock"
}
```

---

### ImprovementResult

**Purpose:** Result of improving a single field.

**Structure to implement:**
- `fieldName: FieldName` - Which field was processed
- `success: boolean` - Whether improvement succeeded
- `changed: boolean` - Whether content actually changed (via hash comparison)
- `newValue?: ManagedField<any>` - Updated field (if changed)
- `error?: string` - Error message (if failed)

---

### ImprovementResponse

**Purpose:** Complete response for batch improvement operation.

**Structure to implement:**
- `results: ImprovementResult[]` - Per-field results
- `updatedRecipe: ManagedRecipe` - Complete recipe with all improvements applied

---

## Conversion Helpers

**Direction:** Create utility functions for converting between wrapped and unwrapped formats.

### UnwrapField Type

**Purpose:** Extract raw value type from `ManagedField<T>`.

**Implementation:** Use TypeScript conditional type: `T extends ManagedField<infer U> ? U : never`

### UnwrappedRecipe Type

**Purpose:** Recipe with all fields unwrapped (legacy BaseRecipe format for backward compatibility).

**Implementation:** Mapped type that unwraps all fields except metadata.

### unwrapRecipe() Function

**Purpose:** Convert `ManagedRecipe` → raw values.

**Logic:**
1. Copy metadata as-is
2. For each field, extract `.value` property
3. Return plain object with raw values

### wrapRecipe() Function

**Purpose:** Convert raw recipe → `ManagedRecipe`.

**Logic:**
1. Copy metadata as-is
2. For each field:
   - Compute SHA-256 hash of value
   - Create `ManagedField` with:
     - `source='inline'`
     - `modifications={ userModified: false, aiModified: false, lastModifiedAt: now }`
3. Return wrapped recipe

**Dependencies:** Requires `ContentHashService` for hash computation.

---

## Validation

### validateManagedRecipe() Function

**Purpose:** Runtime validation for API requests (TypeScript assertion function).

**Validation rules:**
1. Object must exist and be an object type
2. `metadata.urlHash` must be a string
3. All required fields must exist (use `FieldName` type)
4. Each field must have `value`, `lastHash`, `source`, `modifications` properties
5. `modifications` must have `userModified`, `aiModified`, `lastModifiedAt`
6. If `userModified=true`, must have `userModifiedAt`
7. If `aiModified=true`, must have `aiModifiedAt`

**Error handling:** Throw descriptive errors for any validation failures.

---

## Summary

**Core interfaces to implement:**
- `ManagedField<T>` - value, lastHash, source, modifications object
- `FieldModifications` - userModified, aiModified, timestamps
- `ManagedRecipe` - metadata + 12 wrapped fields
- `StoredRecipe` - DynamoDB format with JSON strings
- `ImprovementRequest/Result/Response` - Batch improvement types
- Schema.org supporting types (RecipeInstruction, ImageObject, etc.)

**Helper utilities to implement:**
- `unwrapRecipe()` - Extract raw values
- `wrapRecipe()` - Wrap raw values with hashes
- `validateManagedRecipe()` - Runtime validation
- `isFieldName()` - Type guard

**Next:** [Database Schema](./03-database-schema.md) for DynamoDB design.
