# Core Services

**Prerequisites:** [Data Models](./02-data-models.md), [Database Schema](./03-database-schema.md)
**Next:** [API Endpoints](./05-api-endpoints.md)

---

## Purpose

This document provides **high-level directions** for implementing the three core services that handle business logic for the Lightweight Field Envelope solution.

---

## ContentHashService

**Purpose:** Deterministic content hashing for change detection.

**Responsibilities:**
- Generate SHA-256 hashes from any data type (string, array, object)
- Ensure hash stability (same content → same hash, always)
- Support both sync and async operations

**Key Methods to Implement:**

### hashContent(value: any): Promise<string>
- **Input:** Any value (string, array, object, null)
- **Process:**
  1. Convert value to canonical JSON string (use `canonical-json` library)
  2. Generate SHA-256 hash of the string
  3. Return hex-encoded hash
- **Output:** 64-character hex string
- **Note:** Use Node.js `crypto.createHash('sha256')` for hashing

### compareHashes(hash1: string, hash2: string): boolean
- **Input:** Two hash strings
- **Process:** Simple string equality check
- **Output:** `true` if identical, `false` otherwise
- **Note:** Case-insensitive comparison (normalize to lowercase)

**Design Considerations:**
- Must be deterministic: object key order matters → use canonical-json
- Null and undefined should hash differently
- Empty string, empty array, empty object should have distinct hashes
- Consider caching frequently used hashes (optional optimization)

---

## RecipeMarkdownService

**Purpose:** Bidirectional conversion between JSON-LD and Markdown formats.

**Responsibilities:**
- Convert recipe fields from schema.org JSON-LD to human-readable Markdown
- Parse Markdown back into JSON-LD structure
- Preserve inline formatting (bold, italic, links)
- Maintain schema.org compliance

**Key Methods to Implement:**

### recipeToMarkdown(recipe: ManagedRecipe): string
- **Input:** Complete recipe with wrapped fields
- **Process:**
  1. Extract `.value` from each `ManagedField`
  2. Build Markdown document with sections:
     - Title (H1): `name`
     - Description (paragraph): `description`
     - Metadata: yield, time, category, keywords
     - Ingredients (bulleted list): `recipeIngredient[]`
     - Instructions (numbered steps): `recipeInstructions[]`
     - Optional: nutrition, rating, author
  3. Preserve inline HTML formatting as Markdown equivalents
- **Output:** Complete Markdown string
- **Example structure:**
  ```markdown
  # Recipe Title

  Description text here.

  **Yield:** 4 servings | **Time:** 45 minutes

  ## Ingredients
  - 2 cups flour
  - 1 cup sugar

  ## Instructions
  1. Preheat oven
  2. Mix ingredients
  ```

### markdownToRecipe(markdown: string, metadata: RecipeMetadata): Promise<ManagedRecipe>
- **Input:** Markdown string + original metadata (urlHash, originalUrl, etc.)
- **Process:**
  1. Parse Markdown using `unified` + `remark-parse`
  2. Traverse parsed tree to extract sections:
     - H1 → `name`
     - First paragraph → `description`
     - Bulleted list → `recipeIngredient[]`
     - Numbered list → `recipeInstructions[]` (convert to HowToStep format)
     - Metadata lines → parse yield, time, etc.
  3. Wrap each field in `ManagedField` (compute hash, create initial history entry)
  4. Reconstruct JSON-LD structure
- **Output:** Complete `ManagedRecipe`
- **Error handling:** Throw if required sections missing (name, ingredients, instructions)

### fieldToMarkdown(fieldName: FieldName, value: any): string
- **Purpose:** Convert single field to Markdown fragment
- **Input:** Field name + unwrapped value
- **Process:** Apply field-specific conversion rules:
  - Strings → escape special characters
  - Arrays → bulleted or numbered lists
  - Objects → formatted blocks
  - HowToStep[] → numbered steps with optional headings
- **Output:** Markdown string fragment

### markdownToField(fieldName: FieldName, markdown: string): any
- **Purpose:** Parse Markdown fragment back to typed value
- **Input:** Field name + Markdown string
- **Process:** Apply field-specific parsing rules (reverse of `fieldToMarkdown`)
- **Output:** Typed value matching field's expected type

**Design Considerations:**
- Must be lossless: JSON-LD → Markdown → JSON-LD should produce identical structure
- Preserve schema.org `@type` properties
- Handle edge cases: empty lists, null values, missing optional fields
- Inline formatting: `**bold**` → keep as Markdown in value, or convert to plain text (decision point)
- See [Markdown Conversion](./08-markdown-conversion.md) for detailed rules

---

## ImprovementService

**Purpose:** Orchestrate batch LLM improvements across multiple fields.

**Responsibilities:**
- Coordinate parallel LLM calls for multiple fields
- Manage per-field prompts and context
- Detect changes via hash comparison
- Route storage updates to appropriate location (shared vs user)
- Handle errors gracefully (one field fails, others continue)

**Key Methods to Implement:**

### improveFields(request: ImprovementRequest): Promise<ImprovementResponse>
- **Input:** `ImprovementRequest` with firebaseUID, urlHash, fieldNames[], provider
- **Process:**
  1. Fetch current recipe (merge user + shared baseline)
  2. Fetch raw HTML from S3 (for context)
  3. For each field in `fieldNames`, create improvement task
  4. Execute all tasks in parallel using `Promise.all()`
  5. For each result:
     - Compare new hash with existing hash
     - If changed, update field in appropriate storage location
     - Collect result metadata (success, changed, error)
  6. Build updated `ManagedRecipe` with all changes
- **Output:** `ImprovementResponse` with results[] + updatedRecipe
- **Error handling:** Per-field try-catch, continue on failures

### improveSingleField(fieldName: FieldName, currentValue: any, htmlContext: string, provider: string): Promise<any>
- **Purpose:** Improve one field via LLM
- **Input:** Field name, current value, HTML context, LLM provider
- **Process:**
  1. Get prompt template for field (see [LLM Integration](./07-llm-integration.md))
  2. Build prompt with:
     - Current field value (as Markdown if applicable)
     - Relevant HTML context (ingredients section for ingredients field, etc.)
     - Improvement instructions (clarify, expand, format, etc.)
  3. Call LLM via appropriate provider (Bedrock or ChatGPT)
  4. Parse response (extract improved content)
  5. Validate response (must match expected type/structure)
  6. Convert back to JSON-LD format if needed
- **Output:** Improved value (same type as input)
- **Error handling:** Throw with descriptive error (caller catches)

### determineStorageLocation(field: ManagedField<any>, firebaseUID: string, urlHash: string): { PK: string, SK: string }
- **Purpose:** Determine DynamoDB partition/sort keys for field storage
- **Input:** Field object, user ID, recipe hash
- **Logic:**
  - If field has user history (`field.history.some(h => h.source === 'user')`): return `{ PK: user#${firebaseUID}, SK: recipe#${urlHash} }`
  - If field has no user history: return `{ PK: recipe#${urlHash}, SK: 'base' }`
- **Output:** DynamoDB key object

**Design Considerations:**
- Parallelization: Use `Promise.all()` for speed, not sequential processing
- Timeouts: Set reasonable timeout per LLM call (e.g., 30s)
- Retries: Implement exponential backoff for transient failures
- Context management: Extract relevant HTML sections per field (don't send entire page)
- Prompt templates: Externalize prompts for easy tuning (use existing `prompts/` directory structure)
- See [LLM Integration](./07-llm-integration.md) for prompt design

---

## Service Dependencies

**ContentHashService:**
- External: `canonical-json`, `crypto` (Node.js built-in)
- Internal: None

**RecipeMarkdownService:**
- External: `unified`, `remark-parse`, `unist-util-visit`, `mdast-util-to-string`
- Internal: `ContentHashService` (for hashing when wrapping)

**ImprovementService:**
- External: `@aws-sdk/client-bedrock-runtime`, `openai` (optional)
- Internal: `ContentHashService`, `RecipeMarkdownService`, `DynamoService`, `S3Service`
- Existing: `ChatAgentFactory`, prompt templates from `src/prompts/`

---

## Error Handling Patterns

**ContentHashService:**
- Throw on invalid input (non-serializable objects)
- Never return null or undefined hash

**RecipeMarkdownService:**
- Throw on malformed Markdown (missing required sections)
- Log warnings for optional field parsing failures
- Always return valid schema.org structure

**ImprovementService:**
- Per-field try-catch: capture errors, continue with other fields
- Return partial success: some fields improved, some failed
- Never throw on single field failure (only if all fail or critical error)

---

## Testing Considerations

**ContentHashService:**
- Test hash stability (same input → same hash)
- Test distinctness (different inputs → different hashes)
- Test edge cases (null, undefined, empty, large objects)

**RecipeMarkdownService:**
- Test round-trip conversion (JSON-LD → MD → JSON-LD)
- Test inline formatting preservation
- Test missing/optional fields
- Test malformed Markdown handling

**ImprovementService:**
- Mock LLM responses for deterministic tests
- Test parallel execution (timing, order independence)
- Test partial failures (some fields succeed, some fail)
- Test storage routing (base vs user-edited)

---

## Summary

**Three core services to implement:**

1. **ContentHashService** - Deterministic SHA-256 hashing with canonical JSON
2. **RecipeMarkdownService** - Bidirectional JSON-LD ↔ Markdown conversion
3. **ImprovementService** - Parallel LLM improvements with change detection

**Key principles:**
- Services are stateless (no instance variables for request data)
- Dependencies injected via constructor
- Each service has single clear responsibility
- Error handling is explicit and documented

**Next:** [API Endpoints](./05-api-endpoints.md) for Express route definitions.
