# Database Schema

**Prerequisites:** [Data Models](./02-data-models.md)
**Next:** [Services](./04-services.md)

---

## Purpose

This document defines the DynamoDB table design, partition strategy, and query patterns for the Lightweight Field Envelope solution.

---

## Table Configuration

### Single Table Design

**Table Name:** `RecipeTable` (configurable via environment variable)

**Primary Key:**
- **Partition Key (PK):** String - `recipe#<urlHash>` or `user#<firebaseUID>`
- **Sort Key (SK):** String - `base` or `recipe#<urlHash>`

**Indexes:**
- **None required** - partition key patterns enable all queries

**Capacity:**
- **On-Demand** billing mode (serverless-friendly)
- Auto-scales with traffic

**TTL:**
- **None** - recipes are persistent

---

## Partition Strategy

### Shared Cache Records

**Purpose:** Store scraped baseline recipe shared across all users. Stores both base fields and improvement cache.

**Key Pattern:**
```
PK = recipe#<urlHash>
SK = base
```

**Structure:**
```json
{
  "PK": "recipe#a3f9d2b8e1c4567890abcdef12345678",
  "SK": "base",
  "urlHash": "a3f9d2b8e1c4567890abcdef12345678",
  "originalUrl": "https://example.com/chocolate-cake",
  "createdAt": "2024-01-15T10:30:00Z",
  "lastModified": "2024-01-15T10:30:00Z",
  "schemaVersion": "1.0.0",
  "fields": {
    "name": "<ManagedField JSON string>",
    "description": "<ManagedField JSON string>",
    "nutrition": "<ManagedField JSON string with improvements>"
  }
}
```

**ManagedField Structure in fields map:**
Each field is stored as JSON-stringified `ManagedField<T>`:
```json
{
  "value": ["2 cups flour", "1 tsp salt"],
  "rendered": {
    "type": "markdown",
    "value": "- **2 cups** flour\n- 1 tsp salt",
    "version": "1.0.0"
  },
  "currentHash": "abc123...",
  "baseHash": "abc123...",
  "history": [
    {
      "timestamp": "2025-01-15T10:00:00Z",
      "hash": "abc123...",
      "source": "prepper",
      "actor": "system",
      "summary": "Initial ingestion from recipe webpage"
    }
  ],
  "improvements": {
    "abc123...": {
      "value": ["2 cups all-purpose flour, sifted", "1 tsp kosher salt"],
      "rendered": {
        "type": "markdown",
        "value": "- **2 cups** all-purpose flour, sifted\n- 1 tsp kosher salt",
        "version": "1.0.0"
      },
      "currentHash": "def456...",
      "baseHash": "abc123...",
      "history": [
        {
          "timestamp": "2025-01-15T10:00:00Z",
          "hash": "abc123...",
          "source": "prepper",
          "summary": "Initial ingestion"
        },
        {
          "timestamp": "2025-01-15T11:00:00Z",
          "hash": "def456...",
          "source": "llm",
          "actor": "system",
          "llmModel": "claude-3-5-sonnet-20241022",
          "promptVersion": "recipe-extras-v1.2.0",
          "summary": "AI normalized and clarified ingredients"
        }
      ]
    }
  }
}
```

**Improvement Reuse Logic:**
- `improvements` map is keyed by `baseHash` (permanent deduplication cache, not temporary)
- When User B has field with `baseHash = "abc123..."` and no user history entries
- Chef checks `fields.nutrition.improvements["abc123..."]`
- If found: Return cached improvement (skip LLM call - cost savings)
- If not found: Generate new improvement, store in this map
- **Deterministic improvements:** Same baseHash → Same LLM output (expected)

**Why Nested Improvements Work for MVP:**
- Average improvement: ~500 bytes (field value + metadata, no content duplication)
- DynamoDB limit: 400KB per item
- Theoretical capacity: 400KB ÷ 500 bytes = ~800 unique improvements per field
- **Realistic usage:** <10 unique versions for typical recipe, <100 for viral recipe
- **Nested structure is fine for MVP** - can migrate to separate items later if needed

**Access Pattern:**
- **Write:** Create on first load; Update when base-field improvements generated
- **Read:** Query by `PK=recipe#<urlHash>`, `SK=base`
- **Improvement Lookup:** O(1) via improvements map key (baseHash)

---

### User Records

**Purpose:** Store user-specific edits and AI improvements for fields they've modified.

**Key Pattern:**
```
PK = user#<firebaseUID>
SK = recipe#<urlHash>
```

**Structure:**
```json
{
  "PK": "user#firebase123abc",
  "SK": "recipe#a3f9d2b8e1c4567890abcdef12345678",
  "urlHash": "a3f9d2b8e1c4567890abcdef12345678",
  "originalUrl": "https://example.com/chocolate-cake",
  "createdAt": "2024-01-15T10:30:00Z",
  "lastModified": "2024-01-20T14:22:00Z",
  "schemaVersion": "1.0.0",
  "fields": {
    "name": "<ManagedField JSON string - user edited>",
    "keywords": "<ManagedField JSON string - AI + user edited>"
  }
}
```

**Example ManagedField (user edited only):**
```json
{
  "value": "My Special Cake",
  "rendered": {
    "type": "markdown",
    "value": "My Special Cake",
    "version": "1.0.0"
  },
  "currentHash": "xyz999...",
  "baseHash": "abc123...",
  "history": [
    {
      "timestamp": "2025-01-15T10:00:00Z",
      "hash": "abc123...",
      "source": "prepper",
      "actor": "system",
      "summary": "Initial ingestion"
    },
    {
      "timestamp": "2025-01-15T12:00:00Z",
      "hash": "xyz999...",
      "source": "user",
      "actor": "firebase123abc",
      "summary": "User edited recipe name"
    }
  ]
}
```

**Example ManagedField (AI improved, then user edited):**
```json
{
  "value": ["chocolate", "cake", "homemade", "dessert"],
  "rendered": {
    "type": "markdown",
    "value": "chocolate, cake, homemade, dessert",
    "version": "1.0.0"
  },
  "currentHash": "bbb222...",
  "baseHash": "aaa111...",
  "history": [
    {
      "timestamp": "2025-01-15T10:00:00Z",
      "hash": "aaa111...",
      "source": "prepper",
      "summary": "Initial ingestion"
    },
    {
      "timestamp": "2025-01-15T11:00:00Z",
      "hash": "def456...",
      "source": "llm",
      "llmModel": "claude-3-5-sonnet-20241022",
      "promptVersion": "recipe-extras-v1.0.0",
      "summary": "AI extracted and normalized keywords"
    },
    {
      "timestamp": "2025-01-15T13:00:00Z",
      "hash": "bbb222...",
      "source": "user",
      "actor": "firebase123abc",
      "summary": "User added 'homemade' keyword"
    }
  ]
}
```

**Note:** User records only store fields the user has interacted with. Other fields are read from shared cache and merged at query time.

**Access Pattern:**
- **Write:** Create/update when user edits or AI improves field
- **Read:** Query by `PK=user#<firebaseUID>`, `SK=recipe#<urlHash>`
- **Merge:** Combine user record + shared cache (user fields override, others from shared)

---

## Query Patterns

### 1. Load Recipe (First Time)

**Goal:** Check if recipe exists in shared cache.

**Query:**
```typescript
const params = {
  TableName: 'RecipeTable',
  Key: {
    PK: `recipe#${urlHash}`,
    SK: 'base'
  }
};
const result = await dynamoClient.get(params).promise();
```

**Flow:**
- If exists: return cached baseline
- If not exists: scrape, convert, store, return baseline

---

### 2. Get Recipe (Existing User)

**Goal:** Fetch user's customized version + shared baseline, merge.

**Step 1: Get user record**
```typescript
const userParams = {
  TableName: 'RecipeTable',
  Key: {
    PK: `user#${firebaseUID}`,
    SK: `recipe#${urlHash}`
  }
};
const userRecord = await dynamoClient.get(userParams).promise();
```

**Step 2: Get shared baseline**
```typescript
const baseParams = {
  TableName: 'RecipeTable',
  Key: {
    PK: `recipe#${urlHash}`,
    SK: 'base'
  }
};
const baseRecord = await dynamoClient.get(baseParams).promise();
```

**Step 3: Merge**
```typescript
// For each field:
// - If user record exists AND field has user history (source='user'), use user's version
// - Otherwise, use shared baseline
const merged = mergeRecords(userRecord, baseRecord);
```

---

### 3. Update Recipe (User Edit)

**Goal:** Store changed fields in user record.

**Query:**
```typescript
const params = {
  TableName: 'RecipeTable',
  Key: {
    PK: `user#${firebaseUID}`,
    SK: `recipe#${urlHash}`
  },
  UpdateExpression: 'SET fields.#fieldName = :value, lastModified = :now',
  ExpressionAttributeNames: {
    '#fieldName': fieldName // e.g., 'name'
  },
  ExpressionAttributeValues: {
    ':value': JSON.stringify(updatedManagedField),
    ':now': new Date().toISOString()
  }
};
await dynamoClient.update(params).promise();
```

**Flow:**
1. Compare incoming field hash with stored hash
2. If different, update user record with new value + add history entry with `source='user'`
3. Preserve baseline in shared cache (never modified)

---

### 4. Improve Recipe (LLM Batch)

**Goal:** Update multiple fields after LLM processing.

**Query (per field):**
```typescript
// Determine storage location based on field history
const isUserEdited = field.history.some(h => h.source === 'user');
const PK = isUserEdited ? `user#${firebaseUID}` : `recipe#${urlHash}`;
const SK = isUserEdited ? `recipe#${urlHash}` : 'base';

const params = {
  TableName: 'RecipeTable',
  Key: { PK, SK },
  UpdateExpression: 'SET fields.#fieldName = :value, lastModified = :now',
  ExpressionAttributeNames: {
    '#fieldName': fieldName
  },
  ExpressionAttributeValues: {
    ':value': JSON.stringify(improvedManagedField),
    ':now': new Date().toISOString()
  }
};
await dynamoClient.update(params).promise();
```

**Flow:**
1. For each improved field:
   - If field has no user history, update shared cache
   - If field has user history, update user record only
2. Compare hashes to detect actual changes
3. Only write if hash differs

---

### 5. List User Recipes

**Goal:** Get all recipes for a user (future feature).

**Query:**
```typescript
const params = {
  TableName: 'RecipeTable',
  KeyConditionExpression: 'PK = :pk',
  ExpressionAttributeValues: {
    ':pk': `user#${firebaseUID}`
  }
};
const result = await dynamoClient.query(params).promise();
```

**Returns:** All recipes the user has accessed (user records only).

---

## S3 Storage (Supplementary)

**Bucket:** `recipe-html-fragments` (configurable)

**Key Pattern:** `recipe-<urlHash>.html`

**Purpose:** Store raw HTML for LLM context when improving baseline fields.

**Access Pattern:**
- **Write:** On first load (store scraped HTML)
- **Read:** When improving fields without user history (LLM needs full HTML context)
- **Not needed:** For user-edited fields (use markdown directly)

**Example:**
```typescript
const s3Params = {
  Bucket: 'recipe-html-fragments',
  Key: `recipe-${urlHash}.html`,
  Body: rawHtml,
  ContentType: 'text/html'
};
await s3Client.putObject(s3Params).promise();
```

---

## Data Lifecycle

### New Recipe
```
1. User loads URL
2. Check shared cache (PK=recipe#<hash>, SK=base)
3. If miss: scrape → convert → store shared + S3
4. Return baseline ManagedRecipe
```

### User Edit
```
1. Client sends updated SimplifiedRecipe (markdown strings)
2. Parse markdown → JSON-LD → wrap in ManagedField
3. Detect changed fields (hash comparison)
4. Add history entry with source='user' for each changed field
5. Store changed fields in user record (PK=user#<uid>, SK=recipe#<hash>)
6. Return updated SimplifiedRecipe
```

### LLM Improvement
```
1. Client sends fieldNames[] to improve
2. For each field in parallel:
   a. Get current value + HTML (if base)
   b. Call LLM → new value
   c. Compare hashes
   d. If changed, store in appropriate location (user vs shared)
3. Return updated ManagedRecipe
```

---

## Migration from Existing Schema

If you have existing `BaseRecipe` records:

**Strategy:**
1. Add migration script to backfill shared cache
2. Wrap all fields in `ManagedField` with initial history entry (source='prepper')
3. Compute hashes for all fields (set currentHash = baseHash initially)
4. Keep original records as backup (rename PK to `legacy#...`)

**See:** [Migration](./09-migration.md) for detailed script.

---

## Performance Considerations

### Read Performance
- **GetItem (single recipe):** ~10ms for shared cache + user record
- **Query (user recipes):** ~20ms for 10 recipes, scales linearly

### Write Performance
- **PutItem (new recipe):** ~15ms
- **UpdateItem (field change):** ~10ms
- **Batch improvements:** parallel writes, ~50ms for 5 fields

### Cost Estimation
- **On-demand pricing:** $1.25 per million writes, $0.25 per million reads
- **Typical usage:** 10,000 recipes, 100 users → ~$5/month

---

## Error Handling

### Race Conditions

**Important: User edits NEVER conflict**
- User A's edits: stored in `PK=user#A`, `SK=recipe#abc123`
- User B's edits: stored in `PK=user#B`, `SK=recipe#abc123`
- **Different DynamoDB items = No conflict possible**

**Only potential conflict: Concurrent improvements to shared cache**
- Two users improve same base field simultaneously → both try to update shared cache
- This is acceptable - improvements should be deterministic (same input → same output)

**Solution:** Use DynamoDB conditional writes (optimistic locking).

**Scenario 1: Shared Cache Update (Improvements Only)**

When updating shared cache improvements map, use `ConditionExpression`:

```typescript
// User A and User B both improve nutrition field with baseHash="abc123"
// Only first write should succeed

const params = {
  TableName: 'RecipeTable',
  Key: {
    PK: `recipe#${urlHash}`,
    SK: 'base'
  },
  UpdateExpression: 'SET fields.nutrition.improvements.#baseHash = :improvedField',
  ConditionExpression: 'attribute_not_exists(fields.nutrition.improvements.#baseHash)',
  ExpressionAttributeNames: {
    '#baseHash': baseHash  // e.g., "abc123..."
  },
  ExpressionAttributeValues: {
    ':improvedField': JSON.stringify(improvedManagedField)
  }
};

try {
  await dynamoClient.update(params).promise();
  // Success: First user won, improvement cached
} catch (err) {
  if (err.code === 'ConditionalCheckFailedException') {
    // Another user already cached this improvement
    // Fetch the cached version and use it
    const cached = await fetchCachedImprovement(urlHash, fieldName, baseHash);
    return cached;
  }
  throw err;
}
```

**Scenario 2: User Record Update (Acceptable)**

When updating user records, last-write-wins is acceptable (single user editing):

```typescript
// No condition check needed
const params = {
  TableName: 'RecipeTable',
  Key: {
    PK: `user#${firebaseUID}`,
    SK: `recipe#${urlHash}`
  },
  UpdateExpression: 'SET fields.#field = :value, lastModified = :now',
  ExpressionAttributeNames: {
    '#field': fieldName
  },
  ExpressionAttributeValues: {
    ':value': JSON.stringify(updatedField),
    ':now': new Date().toISOString()
  }
};

await dynamoClient.update(params).promise();
```

**Result:**
- Shared cache protected from concurrent writes (only first improvement cached)
- User records use last-write-wins (acceptable for single-user context)
- No data corruption, worst case: redundant LLM call if second user's improvement rejected

### Data Corruption
- **Problem:** Invalid JSON in `fields` map
- **Solution:** Validate on write, catch parse errors on read, fallback to baseline

### Missing Baseline
- **Problem:** User record exists but shared cache deleted
- **Solution:** Re-scrape URL, rebuild shared cache

---

## Summary

**Table:** Single `RecipeTable` with composite key (PK + SK)

**Patterns:**
- Shared cache: `PK=recipe#<hash>`, `SK=base`
- User record: `PK=user#<uid>`, `SK=recipe#<hash>`

**Queries:**
- Load: GetItem on shared cache
- Get: GetItem on user + shared, merge
- Update: UpdateItem on user record
- Improve: UpdateItem on appropriate location (per field)

**Next:** [Services](./04-services.md) for implementation details.
