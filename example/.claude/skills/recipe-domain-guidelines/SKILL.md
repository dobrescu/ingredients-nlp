---
name: recipe-domain-guidelines
description: Recipe domain model for Chef API using ManagedField pattern. Use when working with recipe data, field wrapping, history tracking, hashing, or recipe storage/retrieval.
---

# Recipe Domain Guidelines - Chef API

## When this skill should be used

Auto-activates when Claude is:

- Working with ManagedRecipe or ManagedField types
- Adding new recipe fields or modifying field structure
- Implementing change tracking or edit history
- Computing content hashes for change detection
- Converting between domain models and storage models
- Implementing user customizations or AI improvements
- Working with recipe mappers or storage routing

Behavioral rules:

- Never break ManagedField contract - all editable fields must be wrapped
- Always use FIELD_CONFIG registry when adding new fields
- Preserve history (keep last 20 entries)
- Never compute hashes manually - use ContentHashService
- User edits always override AI improvements during merge
- Use getDerivedProperties to check if field is user-edited or AI-improved

---

## 1. Core concept: ManagedField<T>

ManagedField wraps every editable recipe field to enable:

- **Change detection** via content hashing
- **Storage routing** - baseline in shared cache, customizations in user records
- **Edit history** with provenance tracking
- **AI improvement metadata** (model, prompt version)
- **Rendered content** for display (markdown, HTML, etc.)

### Structure

```typescript
interface ManagedField<T> {
  value: T;                    // JSON-LD canonical value (source of truth)
  rendered: RenderedContent;   // Display representation
  currentHash: string;         // SHA-256 of current value
  baseHash: string;            // Hash of original unimproved version
  history: HistoryEntry[];     // Edit history (last 20 entries)
}

interface RenderedContent {
  type: 'markdown' | 'html' | 'text' | 'rich';
  value: string;               // Rendered content
  version: string;             // Renderer version (e.g., "1.0.0")
  ref?: string;                // Optional S3 reference
}

interface HistoryEntry {
  timestamp: string;           // ISO 8601
  hash: string;                // Content hash at this point
  source: 'prepper' | 'llm' | 'user';
  actor?: string;              // firebaseUID or 'system'
  summary: string;             // Human-readable description
  llmModel?: string;           // e.g., "claude-sonnet-4"
  promptVersion?: string;      // e.g., "recipe-extras-v1"
}
```

### Example

```typescript
const nameField: ManagedField<string> = {
  value: "Chocolate Chip Cookies",
  rendered: {
    type: 'markdown',
    value: "Chocolate Chip Cookies",
    version: '1.0.0'
  },
  currentHash: "abc123...",
  baseHash: "abc123...",
  history: [
    {
      timestamp: "2025-11-12T10:00:00Z",
      hash: "abc123...",
      source: "prepper",
      actor: "system",
      summary: "Initial ingestion from recipe webpage"
    }
  ]
};
```

---

## 2. ManagedRecipe structure

```typescript
interface ManagedRecipe {
  // Metadata (not wrapped)
  urlHash: string;             // SHA-256 of normalized URL
  originalUrl: string;         // Source URL
  createdAt: string;           // ISO 8601 timestamp
  lastModified: string;        // ISO 8601 timestamp
  schemaVersion: string;       // e.g., "1.0.0"

  // Wrapped fields (all optional except name)
  name?: ManagedField<string>;
  description?: ManagedField<string>;
  headline?: ManagedField<string>;
  recipeYield?: ManagedField<string[]>;
  totalTime?: ManagedField<string>;
  prepTime?: ManagedField<string>;
  cookTime?: ManagedField<string>;
  recipeIngredient?: ManagedField<string[]>;
  recipeInstructions?: ManagedField<RecipeInstruction[]>;
  recipeCategory?: ManagedField<string[]>;
  recipeCuisine?: ManagedField<string[]>;
  keywords?: ManagedField<string>;
  image?: ManagedField<ImageObject>;
  author?: ManagedField<AuthorInformation>;
  aggregateRating?: ManagedField<AggregateRating | null>;
  nutrition?: ManagedField<NutritionInformation | null>;
  video?: ManagedField<VideoObject | null>;
  datePublished?: ManagedField<string>;
}
```

**Key rules:**

- All editable fields are ManagedField-wrapped
- Metadata fields (urlHash, originalUrl, etc.) are NOT wrapped
- Use FIELD_CONFIG registry when adding new fields

---

## 3. Working with ManagedFields

### Wrapping a field

```typescript
import { wrapField } from './utils/recipe/wrap.js';
import { ContentHashService } from './services/content-hash-service.js';

const field = await wrapField(
  "Chocolate Chip Cookies",     // value
  "Chocolate Chip Cookies",     // rendered string
  "prepper",                    // source
  "system",                     // actor
  "Initial ingestion from recipe webpage"  // summary
);
```

### Wrapping a complete recipe

```typescript
import { wrapRecipe } from './utils/recipe/index.js';

const managedRecipe = await wrapRecipe(
  jsonLdRecipe,    // RecipeJsonLd from scraper
  urlHash,         // SHA-256 of normalized URL
  originalUrl      // Source URL
);

// wrapRecipe automatically:
// - Wraps all configured fields
// - Uses FIELD_CONFIG to render each field
// - Creates initial history entries
// - Computes hashes
```

### Checking field status

```typescript
import { getDerivedProperties } from './types/recipe/managed-recipe.js';

const derived = getDerivedProperties(recipe.name);

if (derived.isUserEdited) {
  // User has modified this field - don't override with AI improvements
}

if (derived.isAiImproved) {
  // Field has been enhanced by LLM
}

console.log(derived.lastModifiedAt);  // ISO 8601 timestamp
console.log(derived.lastModifiedBy);  // firebaseUID or 'system'
```

### Computing hashes

```typescript
import { ContentHashService } from './services/content-hash-service.js';

// Compute hash (async!)
const hash = await ContentHashService.hashContent(value);

// Verify hash
const isValid = await ContentHashService.verifyHash(value, expectedHash);

// Compare hashes
const isEqual = ContentHashService.compareHashes(hash1, hash2);
```

---

## 4. FIELD_CONFIG registry (SINGLE SOURCE OF TRUTH)

**To add a new recipe field:**

1. Add to `FieldName` type in managed-recipe.ts
2. Add to FIELD_CONFIG in field-config.ts
3. **Done!** It automatically works everywhere

```typescript
// src/utils/recipe/field-config.ts
export const FIELD_CONFIG: Record<FieldName, FieldConfig> = {
  // Text fields (wire format: string)
  name: { type: 'text', render: renderSimple },
  description: { type: 'text', render: renderSimple },

  // List fields (wire format: markdown list or array)
  recipeIngredient: { type: 'list', render: renderList },
  recipeInstructions: { type: 'list', render: renderInstructions },

  // Object fields (wire format: JSON object)
  nutrition: { type: 'object', render: renderObject },
  author: { type: 'object', render: renderObject },
};

// Get all editable fields
export const EDITABLE_FIELDS = Object.keys(FIELD_CONFIG) as FieldName[];
```

**Field types:**

- `'text'` - Simple strings (sent/received as text/markdown)
- `'list'` - Arrays (rendered as markdown lists)
- `'object'` - Complex objects (sent/received as JSON, NOT markdown)

**This pattern ensures:**

- No code duplication
- Automatic field processing in wrapRecipe, validateManagedRecipe, mappers
- Single place to define rendering logic
- Type-safe field access

---

## 5. Storage models and mappers

### StoredRecipe (DynamoDB format)

```typescript
interface StoredRecipe {
  PK: string;                  // 'recipe#<urlHash>' or 'user#<firebaseUID>'
  SK: string;                  // 'base' or 'recipe#<urlHash>'
  urlHash: string;
  originalUrl: string;
  createdAt: string;
  lastModified: string;
  schemaVersion: string;
  fields: Record<string, string>;  // JSON-stringified ManagedFields
}
```

### Converting between models

```typescript
import { toStoredRecipe, toManagedRecipe, mergeUserAndBaseline }
  from './mappers/recipe-mapper.js';

// Domain → Storage
const stored = toStoredRecipe(managedRecipe, 'shared');
const userStored = toStoredRecipe(managedRecipe, 'user', firebaseUID);

// Storage → Domain
const managed = toManagedRecipe(stored);

// Merge user customizations with baseline
const complete = mergeUserAndBaseline(userRecord, baselineRecipe);
```

**Storage routing:**

- **Shared cache** (`PK: recipe#<urlHash>, SK: base`) - Baseline recipe, unmodified
- **User record** (`PK: user#<firebaseUID>, SK: recipe#<urlHash>`) - User customizations only

When user customizes field → store in user record → merge with baseline on read

---

## 6. Validation

```typescript
import { validateManagedRecipe } from './utils/recipe/index.js';

// Assertion-style validation (throws if invalid)
validateManagedRecipe(recipe);
// TypeScript now knows recipe is valid ManagedRecipe

// Validates:
// - Metadata presence and types
// - ManagedField structure for all present fields
// - HistoryEntry structure
// - RenderedContent structure
```

---

## 7. Typical workflows

### Load recipe (Kassi flow - automatic user save)

```typescript
import { wrapRecipe } from './utils/recipe/index.js';
import { RecipeRepository } from './repositories/recipe-repository.js';

// Normalize URL and compute hash
const normalized = normalizeUrl(url);
const urlHash = createUrlHash(normalized);

// Check shared cache first
const repository = new RecipeRepository();
const cachedRecipe = await repository.getSharedRecipe(urlHash);

if (cachedRecipe) {
  // Cache hit - save to user's record automatically
  await repository.putUserRecipe(firebaseUID, cachedRecipe);
  return { urlHash, recipe: cachedRecipe, cached: true };
}

// Cache miss - scrape from Prepper service
const jsonLdRecipe = await prepperService.scrapeRecipe(normalized);

// Wrap in ManagedFields
const managedRecipe = await wrapRecipe(jsonLdRecipe, urlHash, normalized);

// Save to BOTH shared cache AND user record
await repository.putSharedRecipe(managedRecipe);
await repository.putUserRecipe(firebaseUID, managedRecipe);

// Optional: Generate AI improvements
if (USE_AI) {
  const headlineService = HeadlineGenerationService.create();
  const result = await headlineService.generateHeadline({
    name: managedRecipe.name?.value || '',
    description: managedRecipe.description?.value
  });
  // Apply headline (implementation details omitted)
}

return { urlHash, recipe: managedRecipe, cached: false };
```

**Key changes:**
- Load recipe ALWAYS saves to user's record automatically
- No separate GET needed - load doubles as get
- Returns `urlHash` for subsequent updates

### User edits recipe

```typescript
// Get recipe (merge user + baseline)
const repository = new RecipeRepository();
const userRecord = await repository.getUserRecipe(firebaseUID, urlHash);
const baseline = await repository.getSharedRecipe(urlHash);
const current = mergeUserAndBaseline(userRecord, baseline);

// User modifies name field
const newNameField: ManagedField<string> = {
  ...current.name!,
  value: "My Awesome Cookies",
  rendered: {
    type: 'markdown',
    value: "My Awesome Cookies",
    version: '1.0.0'
  },
  currentHash: await ContentHashService.hashContent("My Awesome Cookies"),
  history: [
    ...current.name!.history,
    {
      timestamp: new Date().toISOString(),
      hash: await ContentHashService.hashContent("My Awesome Cookies"),
      source: "user",
      actor: firebaseUID,
      summary: "User edited recipe name"
    }
  ]
};

current.name = newNameField;
current.lastModified = new Date().toISOString();

// Save to user record (only customized fields)
await repository.putUserRecipe(firebaseUID, current);
```

### AI improves recipe

```typescript
const repository = new RecipeRepository();
const recipe = await repository.getSharedRecipe(urlHash);

// Get raw HTML from S3
const s3Data = await s3Service.getRecipeFragments(urlHash);

// Extract extras using LLM
const extrasService = RecipeExtrasService.create();
const result = await extrasService.extractExtras({
  rawHtml: s3Data.fragments.raw.fragment,
  minificationMap: s3Data.plugins.find(p => p.name === 'minify')?.data
});

// Merge extras into recipe (would need merge helper)
// Only update fields that aren't user-edited

// Save back to shared cache if no user modifications
if (!anyUserEdits) {
  await repository.putSharedRecipe(recipe);
}
```

---

## 8. Best practices

### Always use FIELD_CONFIG

```typescript
// ❌ BAD - Manual field list (out of sync risk)
const fieldsToProcess = ['name', 'description', 'recipeIngredient'];

// ✅ GOOD - Use FIELD_CONFIG
import { EDITABLE_FIELDS, FIELD_CONFIG } from './utils/recipe/field-config.js';

for (const fieldName of EDITABLE_FIELDS) {
  const renderer = FIELD_CONFIG[fieldName].render;
  // Process field
}
```

### Preserve user edits

```typescript
import { getDerivedProperties } from './types/recipe/managed-recipe.js';

// Before applying AI improvement
const derived = getDerivedProperties(recipe.name);
if (derived.isUserEdited) {
  // Skip - don't override user edits
  continue;
}
```

### Prune history

```typescript
import { pruneHistory } from './utils/recipe/index.js';

// Keep last 20 entries
recipe.name = pruneHistory(recipe.name, 20);
```

### Validate before storing

```typescript
import { validateManagedRecipe } from './utils/recipe/index.js';

validateManagedRecipe(recipe);
await repository.putSharedRecipe(recipe);
```

---

## 9. Quick reference

**Wrap recipe:**
```typescript
await wrapRecipe(jsonLdRecipe, urlHash, originalUrl);
```

**Wrap field:**
```typescript
await wrapField(value, renderedString, source, actor, summary);
```

**Hash content:**
```typescript
await ContentHashService.hashContent(value);  // async!
```

**Check field status:**
```typescript
const { isUserEdited, isAiImproved } = getDerivedProperties(field);
```

**Validate:**
```typescript
validateManagedRecipe(recipe);  // throws if invalid
```

**Convert models:**
```typescript
toStoredRecipe(managed, 'shared');
toManagedRecipe(stored);
mergeUserAndBaseline(userRecord, baseline);
```

---

Related skills: `backend-dev-guidelines`, `database-guidelines`, `llm-integration-guidelines`

Last updated: 2025-11-20
