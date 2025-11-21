# Workflows

**Prerequisites:** [API Endpoints](./05-api-endpoints.md), [Services](./04-services.md)
**Next:** [LLM Integration](./07-llm-integration.md)

---

## Purpose

This document provides **step-by-step workflow directions** for each API operation, including decision points, error handling, and data flow.

---

## Workflow 1: Load Recipe (First Time)

**Endpoint:** `POST /api/recipe/load`

**Goal:** Scrape recipe from URL, store in shared cache, return to user.

### Step-by-Step Process

**1. Authenticate & Extract**
- Middleware validates Firebase JWT → extract `firebaseUID`
- Extract `url` from request body
- Validate URL format (HTTP/HTTPS, non-empty)

**2. Normalize URL**
- Remove query parameters (e.g., `?utm_source=...`)
- Remove trailing slash
- Convert to lowercase (domain only)
- Example: `https://Example.com/recipe/?ref=123` → `https://example.com/recipe`

**3. Compute URL Hash**
- Use `ContentHashService.hashContent(normalizedUrl)`
- Store as `urlHash` (64-char hex string)

**4. Check Shared Cache**
- Query DynamoDB:
  - `PK = recipe#${urlHash}`
  - `SK = base`
- If record exists:
  - Deserialize `fields` map (JSON.parse each value)
  - Reconstruct `ManagedRecipe`
  - Return with `{ recipe, cached: true }`
  - **EXIT WORKFLOW** ✅

**5. Scrape URL (Cache Miss)**
- Use existing scraping logic (HTML fetching)
- Extract HTML fragment containing recipe content
- Handle errors:
  - Network failures → 500 error
  - No recipe found → 404 error
  - Parsing failures → 500 error

**6. Extract JSON-LD**
- Parse HTML → find `<script type="application/ld+json">` tags
- Extract schema.org/Recipe object
- Validate required fields (name, recipeIngredient, recipeInstructions)
- If missing → 404 error ("Not a valid recipe page")

**7. Convert HTML to Markdown**
- Detect HTML in text fields (name, description, recipeIngredient items, instruction text)
- Convert inline HTML to Markdown:
  - `<b>`, `<strong>` → `**text**`
  - `<i>`, `<em>` → `_text_`
  - `<a href="url">text</a>` → `[text](url)`
- Store markdown version in `markdownVersion` field (e.g., "1.0.0")
- Use existing or create `HtmlToMarkdownService`

**8. Save Original to S3**
- Save original JSON-LD (before markdown conversion) to S3
- Path: `${baseKey}/recipe.json`
- Preserves original data for potential re-conversion

**9. Wrap in ManagedField**
- Use `RecipeMarkdownService.recipeToMarkdown(rawRecipe)`
- Preserve inline formatting (bold, italic, links)
- Generate human-readable structure

**10. Wrap in ManagedField (now with Markdown)**
- For each field in JSON-LD:
  - Compute hash: `ContentHashService.hashContent(fieldValue)`
  - Create `ManagedField<T>`:
    - `value: fieldValue` (JSON-LD canonical)
    - `rendered: { type: 'markdown', value: <markdown>, version: '1.0.0' }`
    - `currentHash: <computed hash>`
    - `baseHash: <computed hash>` (same as currentHash initially)
    - `history: [{ timestamp, hash, source: 'prepper', actor: 'system', summary: 'Initial ingestion from recipe webpage' }]`
- Build complete `ManagedRecipe` with metadata:
  - `urlHash`, `originalUrl`, `createdAt`, `lastModified`, `schemaVersion`

**9. Store in Shared Cache**
- Serialize each `ManagedField` to JSON string
- Build `StoredRecipe` object:
  - `PK = recipe#${urlHash}`
  - `SK = base`
  - `fields = { name: JSON.stringify(...), ... }`
- Store in DynamoDB (PutItem)
- Handle errors: retry on throttling, fail on permanent errors

**14. Store Raw HTML in S3**
- Upload HTML fragment to S3:
  - Bucket: configured bucket name
  - Key: `recipe-${urlHash}.html`
  - ContentType: `text/html`
- This is used later for LLM context when improving baseline fields
- Handle errors: log but don't fail request (non-critical)

**15. Return Recipe**
- Return `{ recipe: ManagedRecipe, cached: false }`
- Status: 200

### Error Handling

- **Invalid URL:** 400 with `{ error: 'Invalid URL format', code: 'INVALID_URL' }`
- **Scraping failed:** 404 with `{ error: 'Recipe not found', code: 'NOT_FOUND' }`
- **DynamoDB error:** 500 with `{ error: 'Database error', code: 'DB_ERROR' }`
- **S3 error:** Log warning, continue (HTML storage is optional)

---

## Workflow 2: Get Recipe (Existing User)

**Endpoint:** `GET /api/recipe/:urlHash`

**Goal:** Fetch user's customized version, merge with shared baseline.

### Step-by-Step Process

**1. Authenticate & Extract**
- Middleware validates Firebase JWT → extract `firebaseUID`
- Extract `urlHash` from URL params
- Validate hash format (64-char hex)

**2. Fetch User Record**
- Query DynamoDB:
  - `PK = user#${firebaseUID}`
  - `SK = recipe#${urlHash}`
- If not found: user has never accessed this recipe → user record is `null`

**3. Fetch Shared Baseline**
- Query DynamoDB:
  - `PK = recipe#${urlHash}`
  - `SK = base`
- If not found: recipe doesn't exist in shared cache
  - Return 404 with `{ error: 'Recipe not found', code: 'NOT_FOUND' }`
  - User must call `/load` first

**4. Merge Records**
- For each field in `FieldName`:
  - If user record exists AND field has any modifications:
    - Use user's field value
  - Else:
    - Use shared baseline field value
- Build merged `ManagedRecipe`
- Preserve metadata from shared baseline (urlHash, originalUrl, etc.)
- Update `lastModified` to most recent timestamp (user or baseline)

**5. Return Recipe**
- Return `{ recipe: ManagedRecipe }`
- Status: 200

### Merge Logic Pseudocode

```
function mergeRecords(userRecord, baselineRecord):
  merged = { metadata: baselineRecord.metadata }

  for fieldName in ALL_FIELD_NAMES:
    userField = userRecord?.fields[fieldName]
    baseField = baselineRecord.fields[fieldName]

    if userField exists AND hasAnyModifications(userField):
      // User has edited or improved this field, use user's version
      merged[fieldName] = userField
    else:
      // User hasn't touched this field, use shared baseline
      merged[fieldName] = baseField

  return merged

// Helper: Check if field has any history beyond initial ingestion
function hasAnyModifications(field):
  return field.history.length > 1 OR
         field.history.some(h => h.source === 'user' OR h.source === 'llm')
```

### Error Handling

- **Invalid urlHash:** 400 with `{ error: 'Invalid hash format', code: 'INVALID_HASH' }`
- **Recipe not found:** 404 with `{ error: 'Recipe not found', code: 'NOT_FOUND' }`
- **DynamoDB error:** 500 with `{ error: 'Database error', code: 'DB_ERROR' }`

---

## Workflow 3: Update Recipe (User Edits)

**Endpoint:** `PUT /api/recipe/:urlHash`

**Goal:** Detect changed fields, store in user record, return updated recipe.

### Step-by-Step Process

**1. Authenticate & Extract**
- Middleware validates Firebase JWT → extract `firebaseUID`
- Extract `urlHash` from URL params
- Extract `recipe` from request body
- Validate recipe structure using `validateManagedRecipe()`

**2. Fetch Current Recipe**
- Use Workflow 2 (Get Recipe) to fetch current state
- This gives us merged user + baseline for comparison

**3. Detect Changed Fields**
- For each field in incoming recipe:
  - Compare `incomingField.lastHash` with `currentField.lastHash`
  - If different:
    - Mark field as changed
    - Update field hash: `newHash = ContentHashService.hashContent(incomingField.value)`
    - Set `modifications.userModified = true`
    - Set `modifications.userModifiedAt = now`
    - Preserve `modifications.aiModified` if already true
    - Set `source = 'dynamo'`
  - If same:
    - Keep existing field unchanged
- Collect list of `changedFields: FieldName[]`

**4. Check if Any Changes**
- If `changedFields.length === 0`:
  - Return current recipe with `{ recipe, changedFields: [] }`
  - No database write needed
  - Status: 200
  - **EXIT WORKFLOW** ✅

**5. Update User Record**
- For each changed field:
  - Serialize updated `ManagedField` to JSON string
- Build update expression for DynamoDB:
  - `PK = user#${firebaseUID}`
  - `SK = recipe#${urlHash}`
  - UpdateExpression: `SET fields.#field1 = :val1, fields.#field2 = :val2, lastModified = :now`
  - Use ExpressionAttributeNames for field names (avoid reserved words)
- Execute UpdateItem (creates record if doesn't exist)

**6. Handle First Edit**
- If user record doesn't exist yet:
  - Create full user record with:
    - All metadata from shared baseline
    - Only changed fields in `fields` map
    - Unchanged fields can be omitted (merge with baseline on read)
  - Use PutItem instead of UpdateItem

**7. Build Updated Recipe**
- Take current recipe
- Apply changed fields from incoming recipe
- Update `lastModified` timestamp to now

**8. Return Updated Recipe**
- Return `{ recipe: ManagedRecipe, changedFields: FieldName[] }`
- Status: 200

### Change Detection Logic

```
function detectChanges(incomingRecipe, currentRecipe):
  changes = []

  for fieldName in ALL_FIELD_NAMES:
    incomingField = incomingRecipe[fieldName]
    currentField = currentRecipe[fieldName]

    // Recompute hash of incoming value
    incomingHash = hashContent(incomingField.value)

    if incomingHash !== currentField.lastHash:
      changes.push({
        fieldName,
        oldHash: currentField.lastHash,
        newHash: incomingHash,
        newValue: incomingField.value
      })

  return changes
```

### Error Handling

- **Invalid recipe:** 400 with validation details
- **Recipe not found:** 404 (must load first)
- **DynamoDB error:** 500, rollback not needed (idempotent)
- **Hash computation error:** 500 with details

---

## Workflow 4: Improve Recipe (Extract Additional Fields via LLM)

**Endpoint:** `POST /api/recipe/:urlHash/improve`

**Goal:** Extract additional fields (nutrition, storage, tips, etc.) from raw HTML using LLM, reuse cached improvements when possible.

### Step-by-Step Process

**1. Authenticate & Extract**
- Middleware validates Firebase JWT → extract `firebaseUID`
- Extract `urlHash` from URL params
- No request body needed (auto-improves recipe)

**2. Fetch Current Recipe**
- Use Workflow 2 (Get Recipe) to get merged user + baseline
- This gives current field values with history

**3. Fetch Raw HTML Context**
- Get HTML from S3: `recipe-${urlHash}.html`
- If not found: log warning, skip improvement (can't extract without source)

**4. Check for Cached Improvements (Reuse Logic)**

For each extractable field (nutrition, storage, tips, allergens, etc.):

```
field = recipe[fieldName]

// Check if user has edited this field
hasUserHistory = field.history.some(h => h.source === 'user')

if !hasUserHistory:
  // Field hasn't been user-edited, check for cached improvement
  baseHash = field.baseHash

  // Query shared cache improvements map
  cachedImprovement = sharedCache.fields[fieldName].improvements[baseHash]

  if cachedImprovement:
    // Found cached improvement from another user!
    // Use it directly, skip LLM call for this field
    improvements[fieldName] = cachedImprovement
    continue  // Move to next field

// If user has edited OR no cached improvement found, mark for LLM extraction
fieldsToExtract.push(fieldName)
```

**5. Call LLM (recipe-extras prompt)**

If `fieldsToExtract` is not empty:

```
// Fetch raw HTML from S3
const rawHtml = await s3Service.getHtml(urlHash)

// RecipeExtrasService handles HTML obfuscation internally
// It uses HtmlReplacementService to simplify <a> and <img> tags before sending to LLM
const recipeExtrasService = RecipeExtrasService.create()

const extrasResult = await recipeExtrasService.extractExtras({
  rawHtml,  // Service obfuscates internally: <a> → a-1, <img> → img-1
  minificationMap: s3Data.plugins.minify?.data
})

// LLM extracts: { nutrition: {...}, storage: "...", tips: "...", allergens: [...] }
```

**Note:** HTML tag obfuscation (token optimization) is handled internally by `RecipeExtrasService` using `HtmlReplacementService.obfuscate()`. This replaces complex `<a>` and `<img>` tags with simplified versions (e.g., `<a href="a-1">text</a>`) to reduce LLM token usage.

**6. Process and Store Improvements**

For each extracted field:

```
extractedValue = extrasResult.extras[fieldName]
currentField = recipe[fieldName]

// Wrap in ManagedField
improvedField = {
  value: extractedValue,  // JSON-LD canonical
  rendered: {
    type: 'markdown',
    value: convertToMarkdown(extractedValue),
    version: '1.0.0'
  },
  currentHash: hashContent(extractedValue),
  baseHash: currentField.baseHash,
  history: [
    ...currentField.history,
    {
      timestamp: now(),
      hash: hashContent(extractedValue),
      source: 'llm',
      actor: 'system',
      llmModel: 'claude-3-5-sonnet-20241022',
      promptVersion: 'recipe-extras-v1.2.0',
      summary: `AI extracted ${fieldName} from raw HTML`
    }
  ]
}

// Determine storage routing
hasUserHistory = currentField.history.some(h => h.source === 'user')

if !hasUserHistory:
  // Store in BOTH shared cache improvements map AND user record

  // 1. Update shared cache (with race condition protection)
  await updateSharedCacheImprovement(urlHash, fieldName, currentField.baseHash, improvedField)

  // 2. Update user record
  await updateUserField(firebaseUID, urlHash, fieldName, improvedField)
else:
  // User has edited, store ONLY in user record
  await updateUserField(firebaseUID, urlHash, fieldName, improvedField)
```

**7. Build Response**

```
{
  extractedFields: ["nutrition", "storage", "tips"],
  cachedFields: ["allergens"],  // Reused from cache
  recipe: <full ManagedRecipe with improvements>
}
```

**8. Return Response**
- Status: 200 if successful
- Return improved recipe to client (with rendered markdown for Kassi)

### Improvement Reuse Implementation

```typescript
async function checkCachedImprovement(
  sharedCache: ManagedRecipe,
  fieldName: string,
  baseHash: string
): Promise<ManagedField<any> | null> {
  const field = sharedCache[fieldName];

  if (!field || !field.improvements) {
    return null;
  }

  // O(1) lookup by baseHash
  return field.improvements[baseHash] || null;
}
```

### Storage Routing Implementation

```typescript
async function storeImprovement(
  urlHash: string,
  firebaseUID: string,
  fieldName: string,
  improvedField: ManagedField<any>,
  baseHash: string,
  hasUserHistory: boolean
) {
  if (!hasUserHistory) {
    // No user edits: Store in both shared cache and user record

    try {
      // Shared cache with race condition protection
      await updateSharedCacheImprovement(
        urlHash,
        fieldName,
        baseHash,
        improvedField,
        { useConditionalWrite: true }
      );
    } catch (err) {
      if (err.code === 'ConditionalCheckFailedException') {
        // Another user already cached this, that's fine
        console.log(`Improvement already cached for ${fieldName}:${baseHash}`);
      } else {
        throw err;
      }
    }
  }

  // Always update user record
  await updateUserField(firebaseUID, urlHash, fieldName, improvedField);
}
```

### Error Handling

- **Recipe not found:** 404
- **HTML not found in S3:** 400 "Cannot improve without source HTML"
- **LLM timeout:** 500 with error details
- **LLM extraction failed:** 500 with error details
- **DynamoDB error:** 500 with error details

---

## Common Patterns

### URL Normalization

```
function normalizeUrl(url):
  parsed = new URL(url)
  normalized = `${parsed.protocol}//${parsed.hostname.toLowerCase()}${parsed.pathname}`
  // Remove trailing slash
  if normalized.endsWith('/'):
    normalized = normalized.slice(0, -1)
  return normalized
```

### Hash Comparison

```
function hasContentChanged(newValue, currentField):
  newHash = hashContent(newValue)
  return newHash !== currentField.currentHash
```

### Record Merging

```
function mergeUserAndBaseline(userRecord, baselineRecord):
  // Start with baseline
  merged = cloneDeep(baselineRecord)

  // Override with user edits/improvements
  if userRecord:
    for fieldName in userRecord.fields:
      field = JSON.parse(userRecord.fields[fieldName])
      // If field has any modifications (user edits or AI improvements), use user's version
      if hasAnyModifications(field):
        merged.fields[fieldName] = field

  return merged

function hasAnyModifications(field):
  return field.history.length > 1 OR
         field.history.some(h => h.source === 'user' OR h.source === 'llm')
```

---

## Decision Trees

### When to Update Shared Cache vs User Record

```
IF field has NO user history (no source='user' entries):
  → Update shared cache (benefits all users)
  → Also update user record (user's view)
  → All users see change on next load

ELSE IF field has user history (has source='user' entries):
  → Update user record ONLY
  → Skip shared cache (preserve for other users)
  → Only this user sees change
```

### When to Call LLM

```
Current implementation (recipe-extras):
  → ALWAYS uses raw HTML from S3
  → Extracts NEW fields (nutrition, storage, tips, allergens)
  → Doesn't modify existing fields

Future implementation (field improvement):
  IF field has NO user history:
    → Use HTML context from S3
    → Improve based on original source

  ELSE IF field has user history:
    → Use current field value (Markdown)
    → Improve based on user's customization
    → No HTML needed
```

### When to Return 404 vs 200

```
IF recipe not in shared cache:
  → 404 (must call /load first)

ELSE IF user record doesn't exist:
  → 200 with baseline recipe
  → User hasn't edited yet
```

---

## Performance Considerations

**Load Recipe:**
- Cache check: ~10ms
- Scraping: 500-2000ms
- Conversion: 50-100ms
- Storage: 20-50ms
- **Total (cached):** ~10ms
- **Total (new):** 1-2 seconds

**Get Recipe:**
- 2 DynamoDB queries in parallel: ~20ms
- Merge logic: <1ms
- **Total:** ~20ms

**Update Recipe:**
- Fetch: ~20ms
- Hash computation: ~5ms per field
- DynamoDB update: ~15ms
- **Total:** ~100ms for 5 field changes

**Improve Recipe:**
- Fetch: ~20ms
- LLM calls (parallel, 3 fields): 2-5 seconds
- Hash computation: ~5ms per field
- DynamoDB updates: ~50ms
- **Total:** 2-5 seconds (dominated by LLM latency)

---

## Summary

**Four core workflows implemented:**

1. **Load Recipe** - Scrape → Convert → Wrap → Store shared cache + S3
2. **Get Recipe** - Fetch user + baseline → Merge → Return
3. **Update Recipe** - Detect changes → Store user record → Return
4. **Improve Recipe** - Parallel LLM calls → Detect changes → Route storage → Return

**Key principles:**
- Always validate inputs
- Handle partial failures gracefully
- Store based on edit state (shared vs user)
- Use hashes for change detection
- Execute LLM calls in parallel

**Next:** [LLM Integration](./07-llm-integration.md) for prompt design and parallel execution details.
