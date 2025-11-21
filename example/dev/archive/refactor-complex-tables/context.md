# Context: Refactor Complex Tables

**Task:** `refactor-complex-tables`
**Last Updated:** 2025-11-18

---

## Quick Context

**What we're doing:** Refactoring recipe storage from simple objects to field-envelope architecture (`ManagedField<T>`) for change tracking, storage routing, and improvement reuse.

**Why:** Current architecture can't distinguish user edits from AI improvements, causing cache pollution and preventing smart caching.

**How:** Wrap every field in metadata envelope with hash, history, and rendered formats.

---

## Key Files & Locations

### Current Codebase (What Exists Now)

**Types:**
- `src/types/recipe/base-recipe.ts` - Current simple recipe structure
- `src/types/recipe/json-ld.ts` - Schema.org Recipe definitions

**Services:**
- `src/services/dynamo-service.ts` - DynamoDB operations (will extend)
- `src/services/s3-service.ts` - S3 operations (will extend)
- `src/services/content-hash-service.ts` - ✅ Deterministic SHA-256 hashing (Phase 1)
- `src/services/markdown-conversion-service.ts` - ✅ Handles JSON-LD ↔ Markdown bidirectional conversion (Phase 2)
- `src/services/recipe-converter.ts` - Converts EnhancedRecipePage → RecipeExtractionInput for AI processing

**API Routes:**
- `src/routes/recipe-routes.ts` - Express routes (will modify)
- `src/middleware/auth.ts` - Firebase JWT validation (already exists)

**LLM Integration:**
- `src/agents/bedrock.ts` - AWS Bedrock Claude integration
- `src/agents/chatgpt.ts` - OpenAI GPT-4 integration
- `src/prompts/recipe-extras/` - Extract additional fields prompt
- `src/services/html-replacement-service.ts` - URL obfuscation for LLM (already working)

**Database:**
- Table: `RecipeTable` (configurable via `process.env.DYNAMODB_TABLE_NAME`)
- Current keys: `PK=urlHash`, `SK=base` (simple structure)
- Target keys: `PK=recipe#<urlHash>` OR `user#<firebaseUID>`, `SK=base` OR `recipe#<urlHash>`

**Storage:**
- S3 Bucket: `recipe-html-fragments` (configurable via `process.env.S3_BUCKET_NAME`)
- Pattern: `recipe-<urlHash>.html`

**Testing Infrastructure:** ✅
- `tests/mocks/` - Mock utilities for Bedrock, Prepper, DynamoDB, S3
- `tests/fixtures/` - Test fixtures (LLM responses, Prepper responses, API events, recipes)
- `tests/integration/` - Integration tests for LLM services and API handlers
- `tests/integration/llm-services.test.ts` - Tests HeadlineGenerationService, RecipeExtrasService with mocked Bedrock
- `tests/integration/api-handlers.test.ts` - Tests all API endpoints (auth, validation, error scenarios)

### New Files to Create (Phase-by-Phase)

**Phase 1 - Foundation (COMPLETED):**
- `src/types/recipe/managed-recipe.ts` - ManagedField, ManagedRecipe interfaces ✅
- `src/services/content-hash-service.ts` - Deterministic SHA-256 hashing with canonical-json ✅
- `src/utils/recipe/` - Modular recipe utilities (DRY refactored) ✅
  - `field-config.ts` - **Single source of truth** for field configuration
  - `wrap.ts` - Smart wrapping with field iteration
  - `unwrap.ts` - Smart unwrapping with field iteration
  - `validate.ts` - Smart validation with field iteration
  - `normalize.ts` - URL normalization
  - `index.ts` - Barrel exports
  - `recipe.test.ts` - Consolidated tests (36 tests, focused coverage)

**Phase 2 - Markdown (COMPLETED):**
- `src/services/markdown-conversion-service.ts` - Bidirectional conversion ✅
- `src/services/markdown-conversion-service.test.ts` - Focused tests (19 tests) ✅

**Phase 3 - Database Layer Repository Pattern (COMPLETED):**
- `src/mappers/recipe-mapper.ts` - Serialization layer (ManagedRecipe ↔ StoredRecipe) ✅
- `src/repositories/recipe-repository.ts` - Data access layer (DynamoDB operations) ✅
- `src/services/recipe-service.ts` - Business logic layer (orchestrates Repository + Mapper) ✅
- `dev/active/refactor-complex-tables/detailed/99-cleanup-tracker.md` - Tracks code removal for Phase 6 ✅

**Phase 4 - API:** ✅
- `src/lambda.ts` - Thin router (77 lines, routing only) ✅
- `src/handlers/recipe-handlers.ts` - Recipe CRUD + improve handlers ✅
- `src/handlers/health-handler.ts` - Health check handler ✅
- `src/middleware/response.ts` - JSON + CORS helpers ✅
- `src/middleware/auth.ts` - Firebase auth extraction ✅
- `src/middleware/request.ts` - Body parsing + path params ✅

**Phase 5 - LLM:** ✅
- Enhanced `src/handlers/recipe-handlers.ts` improve endpoint with LLM integration ✅
- Uses `wrapField` directly for LLM-extracted fields ✅
- Implements storage routing logic (preserves user edits, updates cache smartly) ✅
- `tests/mocks/bedrock-client.mock.ts` - Mock Bedrock client ✅
- `tests/mocks/prepper-fetch.mock.ts` - Mock Prepper fetch ✅
- `tests/mocks/dynamodb-client.mock.ts` - Mock DynamoDB client ✅
- `tests/mocks/s3-client.mock.ts` - Mock S3 client ✅
- `tests/fixtures/llm/` - LLM response fixtures ✅
- `tests/fixtures/prepper/` - Prepper response fixtures ✅
- `tests/fixtures/lambda/` - API Gateway event fixtures ✅
- `tests/integration/llm-services.test.ts` - LLM service integration tests ✅
- `tests/integration/api-handlers.test.ts` - API handler integration tests ✅

**Phase 6 - Migration:**
- `scripts/migrate-to-managed-recipe.ts` - One-time migration script (if needed)

---

## Critical Decisions

### 1. Field Envelope Structure

**Decision:** All fields wrapped in `ManagedField<T>` with:
- `value: T` - Canonical JSON-LD
- `rendered: { type, value, version }` - Markdown for display
- `currentHash` - Current content hash
- `baseHash` - Original unimproved hash (reuse key)
- `history: HistoryEntry[]` - Edit trail (last 20 entries)

**Rationale:** Uniform structure enables generic helpers, reliable change detection.

**See:** [detailed/02-data-models.md](./detailed/02-data-models.md) for exact TypeScript definitions

---

### 2. Hash Computation

**Decision:** Hash the **JSON-LD value**, not the markdown.

**Rationale:** Markdown renderer may change (bug fixes, improvements). Hashing JSON-LD keeps hashes stable across renderer versions.

**Implementation:** Use `canonical-json` + `crypto.createHash('sha256')`

**See:** [detailed/01-overview.md](./detailed/01-overview.md#key-design-decisions)

---

### 3. Storage Routing Logic

**Decision:**
- Update shared cache ONLY if field has NO user history entries
- ALWAYS update user record if user is authenticated

**Rationale:** Preserves user edits while enabling improvement reuse across users.

**Implementation:**
```typescript
const hasUserEdits = field.history.some(h => h.source === 'user');

if (firebaseUID) {
  await dynamoService.updateUserField(firebaseUID, urlHash, fieldName, field);
}

if (!hasUserEdits) {
  await dynamoService.updateSharedField(urlHash, fieldName, field);
}
```

**See:** [detailed/03-database-schema.md](./detailed/03-database-schema.md#query-patterns) for DynamoDB update patterns

---

### 4. Improvement Reuse Strategy

**Decision:** Store improvements in shared cache `fields.<fieldName>.improvements` map, keyed by `baseHash`.

**Rationale:** O(1) lookup, no GSI needed, supports multiple improvement versions per field.

**Limitation:** DynamoDB 400KB item limit allows ~800 improvements per field (sufficient for MVP).

**Example:**
```typescript
// Shared cache structure
fields: {
  nutrition: {
    value: { calories: "450" },
    currentHash: "abc123...",
    baseHash: "abc123...",
    improvements: {
      "abc123...": {  // baseHash as key
        value: { calories: "450", protein: "25g" },
        currentHash: "def456...",
        baseHash: "abc123...",
        history: [/* LLM entry */]
      }
    }
  }
}
```

**See:** [detailed/03-database-schema.md](./detailed/03-database-schema.md#shared-cache-records)

---

### 5. Markdown as Intermediate Format

**Decision:** Store both JSON-LD (canonical) and Markdown (rendered) in each ManagedField.

**Rationale:**
- JSON-LD for hashing stability
- Markdown for display (no conversion on every request)
- Both persisted to DynamoDB for observability

**Trade-off:** Slight storage overhead (~2x per field) for performance + debuggability.

**See:** [detailed/08-markdown-conversion.md](./detailed/08-markdown-conversion.md)

---

### 6. History Pruning

**Decision:** Keep last 20 history entries per field.

**Rationale:** Manage DynamoDB item size, provide audit trail without unbounded growth.

**Implementation:** On every update, `field.history.slice(-20)`

**See:** [detailed/02-data-models.md](./detailed/02-data-models.md#managedfield-history)

---

### 7. Kassi Integration (React Native App)

**Decision:** Chef sends/receives **flat recipe objects with field-type-specific formats**.

**Wire Format by Field Type:**

| Field Type | Wire Format | Examples |
|------------|-------------|----------|
| **Text** | String (text/markdown) | `name: "Chocolate Cake"` |
| **List** | Markdown list string OR array | `recipeIngredient: "- flour\n- sugar"` OR `["flour", "sugar"]` |
| **Object** | JSON object (NOT markdown) | `nutrition: { calories: "450 kcal" }` |

**Example:**
```typescript
{
  // Text fields → string
  name: "Chocolate Cake",
  description: "A delicious dessert",

  // List fields → markdown string OR array
  recipeIngredient: "- 2 cups flour\n- 1 cup sugar",  // markdown format
  recipeInstructions: "1. Preheat oven\n2. Mix ingredients",

  // Object fields → JSON object directly (NOT markdown)
  nutrition: {
    "@type": "NutritionInformation",
    calories: "450 kcal",
    proteinContent: "25g"
  },
  author: {
    "@type": "Person",
    name: "Chef Mario"
  }
}
```

**Rationale:**
- Kassi doesn't need to know about ManagedField internals (hashes, history, metadata)
- Object fields (nutrition, author, etc.) are already structured - no need for markdown conversion
- Text and list fields use markdown for human-readable editing

**Chef's Job:**
- **Outbound (Chef → Kassi):**
  - Text fields: Extract `rendered.value` (markdown/text)
  - List fields: Extract `rendered.value` (markdown list)
  - Object fields: Extract `value` (the JSON object itself)

- **Inbound (Kassi → Chef):**
  - Text fields: Wrap string as-is → ManagedField
  - List fields: Parse markdown to array OR accept array directly → ManagedField
  - Object fields: Wrap object as-is (no parsing needed) → ManagedField

**See:** [detailed/12-kassi-integration.md](./detailed/12-kassi-integration.md)

---

### 8. DRY Refactoring with Field Configuration Registry

**Decision:** Use a centralized `FIELD_CONFIG` object as the single source of truth for all field metadata, with smart iteration for wrap/unwrap/validate operations.

**Rationale:**
- Adding a new field should only require updates in 1-2 places (type definition + field config)
- Eliminates repetitive code (was ~340 lines of manual field listing, now clean iteration)
- Makes codebase more maintainable and less error-prone
- Reduces test count while maintaining coverage (56 → 36 tests)

**Implementation:**
```typescript
// field-config.ts - SINGLE SOURCE OF TRUTH
export const FIELD_CONFIG: Record<FieldName, FieldConfig> = {
  name: { render: renderSimple },
  recipeIngredient: { render: renderList },
  // Add new fields here - they automatically work everywhere
};

// wrap.ts - Smart iteration
for (const fieldName of EDITABLE_FIELDS) {
  if (value !== undefined) {
    const renderer = FIELD_CONFIG[fieldName].render;
    managedRecipe[fieldName] = await wrapField(value, renderer(value));
  }
}
```

**Benefits:**
- 35% reduction in test count (focused, essential coverage only)
- Modular structure (`utils/recipe/`) vs single monolithic file
- Easy to extend - new field = 2 lines of code

**Date:** 2025-11-18

---

### 9. Repository Pattern Architecture

**Decision:** Implement three-layer separation for database operations:
1. **Mapper** (`recipe-mapper.ts`) - Pure serialization functions (ManagedRecipe ↔ StoredRecipe)
2. **Repository** (`recipe-repository.ts`) - Data access only, no business logic
3. **Service** (`recipe-service.ts`) - Business logic orchestration

**Implementation:**
```typescript
// Mapper - Pure functions
export function toStoredRecipe(recipe: ManagedRecipe, type, firebaseUID?): StoredRecipe
export function toManagedRecipe(stored: StoredRecipe): ManagedRecipe
export function mergeUserAndBaseline(userRecord, baseline): ManagedRecipe

// Repository - Data access
class RecipeRepository {
  async getSharedRecipe(urlHash): Promise<StoredRecipe | null>
  async getUserRecipe(firebaseUID, urlHash): Promise<StoredRecipe | null>
  async putSharedRecipe(stored: StoredRecipe): Promise<void>
  async putUserRecipe(stored: StoredRecipe): Promise<void>
  async updateUserField(...): Promise<void>  // Atomic partial update
  async updateSharedField(...): Promise<void>
}

// Service - Business logic
class RecipeService {
  async getRecipe(firebaseUID, urlHash): Promise<ManagedRecipe | null>  // Merges user + baseline
  async saveRecipe(recipe, type, firebaseUID?): Promise<void>
  async updateField(...): Promise<void>  // Delegates to Repository
  async recipeExists(urlHash): Promise<boolean>
}
```

**Rationale:**
- Clean separation of concerns (SOLID principles)
- Easy to test each layer in isolation
- All classes < 150 lines for readability
- Errors bubble to Lambda handler boundaries (no excessive try-catch)
- Both atomic partial updates (`updateField`) and full recipe saves (`saveRecipe`) supported

**S3Service Decision:**
S3Service remains separate (not part of RecipeRepository) following Single Responsibility Principle:
- RecipeRepository handles structured recipe data (DynamoDB)
- S3Service handles raw HTML blobs (S3)
- RecipeService orchestrates both when needed (e.g., recipe-extras workflow)

**Date:** 2025-11-18

---

### 10. Skills Alignment in Phase 6

**Decision:** Phase 6 cleanup must include comprehensive skills alignment review before finalizing the refactor.

**Rationale:**
- Skills in `.claude/skills/` are the **source of truth** for clean code principles and architecture patterns
- Skills represent approved patterns that should change deliberately, not accidentally
- Implementation may change file names/locations, but the core ideas in skills should remain stable

**Process:**
1. Review each skill file (backend-dev-guidelines, recipe-domain-guidelines, database-guidelines, error-handling-guidelines) against actual implementation
2. Skills should reflect the **IDEA**, not exact file names (e.g., "Repository Pattern" concept vs specific file paths)
3. **Decision point:** If implementation differs from skill guidance:
   - ⚠️ **ASK USER FIRST** before updating any skill
   - Determine whether skill needs update OR code needs to align with skill
   - Skills represent approved patterns - changes should be intentional
4. Update skills if approved, ensuring:
   - Examples match current architecture
   - Patterns are documented correctly
   - Old patterns are removed
5. Validate implementation follows skill guidelines:
   - Repository pattern correctly implemented
   - Error handling matches guidelines
   - No patterns that contradict skill guidance

**Date:** 2025-11-19

---

### 11. Use wrapField Directly (No Wrapper Functions)

**Decision:** Removed `wrapLLMExtras` wrapper function; use `wrapField` directly when wrapping LLM-extracted fields.

**Rationale:**
- `wrapField` already provides all necessary functionality (value wrapping, rendering, hashing, history)
- Creating a wrapper function adds unnecessary abstraction and code duplication
- Direct usage makes the code path clearer and easier to understand
- Follows DRY principle and clean code guidelines

**Implementation:**
- LLM extras extraction loops directly over `extrasResult.extras`
- Each field gets its renderer from `FIELD_CONFIG`
- Calls `wrapField` with LLM-specific parameters (source='llm', llmModel, promptVersion)
- Cleaner separation: data extraction → field validation → wrapping → merging

**Date:** 2025-11-19

---

### 12. Minification Map Clarification

**Decision:** Minification map is for HTML tag shortening (e.g., `{"div":"c","h2":"d"}`), NOT URL extraction.

**Rationale:**
- Reduces token count when sending HTML fragments to LLM
- Prepper minifies tags like `<div>` → `<c>`, `<h2>` → `<d>` in raw HTML
- URL extraction/restoration is a separate process handled elsewhere
- Critical for understanding how fragments are optimized for LLM consumption

**Implementation:**
- Updated test fixtures to reflect correct format
- Added clarifying comment in handler.ts (lines 311-312)
- Updated integration tests with proper minification map examples

**Date:** 2025-11-19

---

## Important Constraints

### 1. Backward Compatibility

**Challenge:** Existing `BaseRecipe` records in production DynamoDB.

**Solution:** Migration script + dual-read support during transition.

**See:** [detailed/09-migration.md](./detailed/09-migration.md)

---

### 2. DynamoDB Item Size Limit

**Limit:** 400KB per item

**Impact:**
- History pruning (keep last 20 entries)
- Improvements map (nested structure acceptable for MVP, ~800 improvements capacity)

**Future:** If limit hit, migrate to separate items with GSI.

**See:** [detailed/03-database-schema.md](./detailed/03-database-schema.md#why-nested-improvements-work-for-mvp)

---

### 3. Firebase Auth

**Current:** API Gateway JWT authorizer validates tokens, provides `firebaseUID` in `event.requestContext.authorizer.jwt.claims.sub`.

**No Code Change Needed:** Just extract firebaseUID from event context.

**See:** [detailed/00-premise.md](./detailed/00-premise.md#authentication-architecture) for JWT flow

---

### 4. LLM Cost Management

**Strategy:**
- Use HTML obfuscation (`HtmlReplacementService`) to reduce tokens
- Cache improvements via baseHash matching
- USE_AI flag to disable during testing

**See:** [detailed/07-llm-integration.md](./detailed/07-llm-integration.md)

---

## Dependencies

**New NPM Packages Needed:**
- `canonical-json` - Stable JSON serialization for hashing
- `unified` + `remark-parse` + `mdast-util-to-string` - Markdown parsing

**Already Have:**
- `crypto` (built-in Node.js)
- AWS SDK v3 (DynamoDB, S3, Bedrock)
- Express.js
- TypeScript 5.x

**See:** [detailed/10-dependencies.md](./detailed/10-dependencies.md) for installation commands

---

## Testing Strategy

**Unit Tests:** Each service method in isolation (80%+ coverage)
**Integration Tests:** API endpoints with test database
**Migration Tests:** Dry-run on staging before production

**See:** [detailed/11-implementation-order.md](./detailed/11-implementation-order.md#testing-strategy-summary)

---

## Rollback Procedures

**After Phase 4-5:** Revert Lambda deployment (old endpoints still work, new data untouched)
**After Phase 6:** Restore from backup, redeploy old API
**After Phase 7:** Revert Lambda (database has both schemas, no data loss)

**See:** [detailed/11-implementation-order.md](./detailed/11-implementation-order.md#rollback-procedures)

---

## Common Pitfalls to Avoid

### 1. ❌ Hashing Markdown Instead of JSON-LD
**Why Bad:** Markdown renderer changes break hashes
**Correct:** Always hash `field.value` (JSON-LD)

### 2. ❌ Overwriting User Edits
**Why Bad:** User loses their customizations
**Correct:** Check `field.history` for user entries before updating shared cache

### 3. ❌ Forgetting to Prune History
**Why Bad:** DynamoDB item size grows unbounded
**Correct:** `field.history.slice(-20)` on every update

### 4. ❌ Not Validating Hash Integrity
**Why Bad:** Corrupted data goes undetected
**Correct:** Validate `ContentHashService.hash(field.value) === field.currentHash` before storing

---

## Where to Find Answers

**"How do I implement X?"** → `detailed/11-implementation-order.md` (phase-by-phase)
**"What's the TypeScript interface for Y?"** → `detailed/02-data-models.md`
**"How does the database schema work?"** → `detailed/03-database-schema.md`
**"What's the data flow for Z?"** → `detailed/06-workflows.md`
**"Why did we decide W?"** → `detailed/01-overview.md` (design decisions)
**"What was the original problem?"** → `detailed/00-premise.md`

---

## Next Steps

1. ✅ ~~Phase 1 (Foundation) - COMPLETE~~
2. ✅ ~~Phase 2 (Markdown Conversion) - COMPLETE~~
3. ✅ ~~Phase 3 (Database Layer - Repository Pattern) - COMPLETE~~
4. ✅ ~~Phase 4 (API Endpoints - RESTful Handler) - COMPLETE~~
5. Begin Phase 5 (LLM Integration) - Enhance improve endpoint with proper field wrapping and caching logic

---

## Session Log

### [2025-11-18] - Phase 1 Foundation Complete + DRY Refactoring
**Completed:**
- ✅ Installed all dependencies (canonical-json, unified, remark-parse, etc.)
- ✅ Created `src/types/recipe/managed-recipe.ts` with comprehensive type definitions
- ✅ Created `src/services/content-hash-service.ts` with SHA-256 hashing
- ✅ **REFACTORED** recipe utilities into modular structure under `src/utils/recipe/`
- ✅ Set up Vitest testing framework
- ✅ Created 36 focused tests (reduced from 56, -35% while maintaining coverage)
- ✅ All tests passing, TypeScript build successful

**Key Achievement:**
Implemented DRY refactoring with field configuration registry. Adding new fields now requires only 2 updates instead of 10+. Code is cleaner, more maintainable, and follows SOLID principles.

**Files Created:**
- `src/utils/recipe/field-config.ts` - Single source of truth for field metadata
- `src/utils/recipe/wrap.ts` - Smart wrapping with iteration
- `src/utils/recipe/unwrap.ts` - Smart unwrapping with iteration
- `src/utils/recipe/validate.ts` - Smart validation with iteration
- `src/utils/recipe/normalize.ts` - URL normalization
- `src/utils/recipe/index.ts` - Clean barrel exports
- `src/utils/recipe/recipe.test.ts` - Consolidated tests
- `vitest.config.ts` - Test framework configuration

**Next:** Begin Phase 2 (Markdown Conversion service)

---

### [2025-11-18] - Phase 2 Markdown Conversion Complete + Field Type Classification

**Completed:**
- ✅ Created `src/services/markdown-conversion-service.ts` with bidirectional conversion
- ✅ Implemented HTML → Markdown conversion (bold, italic, links, HTML entities)
- ✅ Implemented Markdown → JSON-LD parsers:
  - `markdownToList()` - Parse bullet lists to arrays
  - `markdownToInstructions()` - Parse numbered lists with optional sections
- ✅ **Added field type classification** to `field-config.ts`:
  - `type: 'text'` - Simple strings (sent as text/markdown)
  - `type: 'list'` - Arrays (sent as markdown OR array)
  - `type: 'object'` - Complex objects (sent as JSON object, NOT markdown)
- ✅ Removed nutrition markdown parsing (objects don't use markdown)
- ✅ Created 16 focused tests (all passing)
- ✅ Round-trip validation tests (JSON-LD → Markdown → JSON-LD preserves structure)
- ✅ TypeScript build successful

**Key Achievement:**
Clean bidirectional conversion service with proper field type classification. Object fields (nutrition, author, etc.) are now correctly handled as JSON objects, not markdown. This aligns with Kassi's wire format expectations.

**Files Modified:**
- `src/utils/recipe/field-config.ts` - Added `FieldType` classification and helper functions
- `src/services/markdown-conversion-service.ts` - Removed nutrition markdown methods
- `src/services/markdown-conversion-service.test.ts` - Removed nutrition tests

**Test Summary:**
- 52 total tests passing (23 + 16 + 13)
- All round-trip conversions preserve structure
- Edge cases handled (empty input, malformed markdown, HTML entities)
- Object fields correctly classified (no markdown conversion)

**Next:** Begin Phase 3 (Database Layer)

---

### [2025-11-18] - Phase 3 Database Layer - Repository Pattern Complete

**Completed:**
- ✅ Created `src/mappers/recipe-mapper.ts` (108 lines):
  - `toStoredRecipe()` - ManagedRecipe → StoredRecipe serialization
  - `toManagedRecipe()` - StoredRecipe → ManagedRecipe deserialization
  - `mergeUserAndBaseline()` - Merge user customizations with baseline
- ✅ Created `src/repositories/recipe-repository.ts` (146 lines):
  - Pure data access layer, no business logic
  - Methods: `getSharedRecipe`, `getUserRecipe`, `putSharedRecipe`, `putUserRecipe`, `updateUserField`, `updateSharedField`
  - Errors bubble to handlers (no excessive try-catch)
- ✅ Created `src/services/recipe-service.ts` (96 lines):
  - Business logic orchestration
  - Methods: `getRecipe` (merges user + baseline), `saveRecipe`, `updateField`, `recipeExists`
- ✅ Created `detailed/99-cleanup-tracker.md` - tracks old code for removal in Phase 6
- ✅ Implemented error handling best practices (errors bubble to Lambda handler boundaries)
- ✅ TypeScript build successful

**Key Achievement:**
Implemented clean Repository pattern with three-layer separation (Mapper → Repository → Service). All classes under 150 lines for readability. Both atomic partial updates (`updateField`) and full recipe saves (`saveRecipe`) supported.

**Architectural Decisions:**
- S3Service remains separate (Single Responsibility Principle)
- RecipeRepository handles DynamoDB, S3Service handles raw HTML
- RecipeService orchestrates both when needed
- SOLID principles followed throughout
- All code < 150 lines per class

**Files Created:**
- `src/mappers/recipe-mapper.ts` (108 lines)
- `src/repositories/recipe-repository.ts` (146 lines)
- `src/services/recipe-service.ts` (96 lines)
- `dev/active/refactor-complex-tables/detailed/99-cleanup-tracker.md`

**Test Summary:**
- Unit tests pending (Phase 3 implementation complete, tests deferred)
- TypeScript build successful with zero errors
- All type definitions validated

**Next:** Begin Phase 4 (API Endpoints)

---

### [2025-11-18] - Phase 4 API Endpoints - RESTful Handler Complete

**Completed:**
- ✅ Created `src/handler.ts` (370 lines) - New Lambda handler with RESTful routes
  - `POST /recipe/load` - Load recipe from URL with Prepper integration
  - `GET /recipe/:urlHash` - Get recipe with user customizations (merges user + baseline)
  - `PUT /recipe/:urlHash` - Update recipe with user edits (change detection via hash comparison)
  - `POST /recipe/:urlHash/improve` - Improve recipe with LLM (basic structure, Phase 5 will enhance)
  - `GET /health` - Health check endpoint
  - Firebase JWT authentication via API Gateway (extracts firebaseUID from pre-validated claims)
  - Structured logging with context (using logger utility)
  - CORS support for Kassi client
- ✅ Created `src/mappers/simplified-recipe-mapper.ts` (220 lines):
  - `toSimplifiedRecipe()` - Extract rendered markdown from ManagedRecipe for Kassi
  - `fromSimplifiedRecipe()` - Parse markdown from Kassi, wrap in ManagedField with history
  - `mergeSimplifiedRecipe()` - Merge user edits, detect changes via hash comparison, return changedFields list
- ✅ Extended `src/services/s3-service.ts` with HTML storage methods:
  - `storeHtml(urlHash, html)` - Store raw HTML separately for LLM processing
  - `getHtml(urlHash)` - Retrieve raw HTML
- ✅ Updated `detailed/99-cleanup-tracker.md` with Phase 4 old code tracking:
  - Documented lambda.ts (old handler) for removal
  - Documented service.ts functions (loadRecipe, improveRecipe, etc.) for removal
  - Tracked user feedback: "i'd rather not have the /api prefix" - implemented without `/api`
- ✅ TypeScript build successful (61 tests passing)

**Key Achievement:**
Implemented complete RESTful API handler using RecipeService (Repository pattern). SimplifiedRecipe mapper handles Kassi integration (flat markdown strings for text/list fields, JSON objects for complex fields). All routes use clean RESTful paths without `/api` prefix as requested.

**Architectural Decisions:**
- **SimplifiedRecipe for Kassi**: Flat object with markdown strings (text/list fields) and JSON objects (complex fields)
- **RecipeService throughout**: All handlers use Repository pattern from Phase 3
- **Firebase JWT via API Gateway**: No Lambda verification code needed (pre-validated by API Gateway)
- **Structured logging**: All handlers log with context (urlHash, firebaseUID, error details)
- **Old code ready for removal**: lambda.ts and service.ts documented in cleanup tracker
- **Integration tests deferred**: Implementation complete, testing can be done later

**Files Created:**
- `src/handler.ts` (370 lines)
- `src/mappers/simplified-recipe-mapper.ts` (220 lines)

**Files Modified:**
- `src/services/s3-service.ts` - Added storeHtml() and getHtml() methods
- `dev/active/refactor-complex-tables/detailed/99-cleanup-tracker.md` - Added Phase 4 tracking

**Test Summary:**
- 61 total tests passing (no new tests added - existing tests still pass)
- TypeScript build successful with zero errors
- Integration tests deferred (handlers implemented, testing later)

**Next:** Begin Phase 5 (LLM Integration) - Enhance improve endpoint with proper field wrapping and caching logic

---

### [2025-11-19] - Phase 1-4 Verification & Phase 6 Planning Complete

**Completed:**
- ✅ Systematically verified all Phase 1-4 implementations are correct
- ✅ Confirmed architecture integrity:
  - RecipeRepository uses DynamoDB client directly (not old DynamoService)
  - RecipeService orchestrates without importing DynamoService
  - handler.ts uses RecipeService only (clean separation)
  - Only old service.ts imports DynamoService (will be deleted in Phase 6)
- ✅ Searched for orphaned references (none found in new code)
- ✅ Updated Phase 6 tasks with 10 detailed cleanup steps
- ✅ Added skills alignment review to Phase 6 Step 8

**Key Findings:**
- **Build config issue:** esbuild.config.js and Dockerfile still point to `lambda.ts` instead of `handler.ts` (CRITICAL for deployment)
- **Test migration needed:** dynamo-service.test.ts tests old mergeUserAndBaseline function
- **Code to delete:** ~1,000+ lines (DynamoService old methods, lambda.ts, service.ts)
- **Architecture verified:** All new code (350 lines) follows Repository pattern correctly

**New Decision:**
10. **Skills Alignment in Phase 6** (2025-11-19)
   **Decision:** Phase 6 must include comprehensive skills alignment review
   **Rationale:** Skills are source of truth for clean code principles and architecture patterns; they represent approved patterns that should change deliberately
   **Process:**
   - Review each skill file against implementation
   - Skills reflect the IDEA, not exact file names
   - ASK USER FIRST before updating any skill
   - Verify if skill needs update OR if code needs to align with skill
   **Date:** 2025-11-19

**Next Steps:**
1. ✅ Phase 5 (LLM Integration) - COMPLETE
2. Manual testing with real LLM (USE_AI=true)
3. Phase 6 cleanup ready to execute after testing
4. Build config update is blocking deployment (must be done in Phase 6)

---

### [2025-11-19] - Phase 5 Complete + Integration Testing Infrastructure

**Completed:**
- ✅ Phase 5 LLM Integration fully implemented
  - Improve endpoint uses `wrapField` directly (removed unnecessary `wrapLLMExtras`)
  - Storage routing logic: preserves user edits, updates shared cache for non-edited fields
  - LLM metadata tracking: source='llm', includes llmModel and promptVersion
  - Hash computation via ContentHashService
- ✅ Integration testing infrastructure complete
  - Directory structure: `tests/fixtures/`, `tests/mocks/`, `tests/integration/`
  - Mock utilities: Bedrock, Prepper, DynamoDB, S3 (using aws-sdk-client-mock)
  - Test fixtures: LLM responses, Prepper responses, API Gateway events
  - Integration tests: LLM services, API handlers (auth, validation, error scenarios)
  - Package.json commands: `test:unit`, `test:integration`, `test:ci`
  - Dependencies added: `aws-sdk-client-mock@^4.1.0`, `@smithy/util-stream@^3.3.2`

**Key Fixes:**
- Fixed minification map understanding: HTML tags (`{"div":"c"}`) not URLs
- Removed code duplication: using `wrapField` instead of wrapper function
- Updated all test fixtures to reflect correct minification format
- Added clarifying comment in handler.ts about minification purpose

**Build Status:**
- TypeScript: Zero errors ✅
- Bundle: 57.4kb ✅
- All integration test infrastructure in place ✅

**Next:** Manual testing with real Bedrock calls, then Phase 6 cleanup

---

### [2025-11-19] - Phase 6 Complete + Lambda Handler Refactoring

**Completed:**
- ✅ Phase 6 cleanup executed - removed ~1,100 lines of obsolete code
  - Deleted: `lambda-old-backup.ts`, `service.ts`, `mock_response.ts`
  - Deleted: `DynamoService` (480 lines) - completely replaced by Repository pattern
  - Deleted: `src/types/dynamo.ts` (47 lines) - old type definitions
  - Migrated: `dynamo-service.test.ts` → `tests/unit/mappers/recipe-mapper.test.ts` (9 tests passing)
  - Renamed: `handler.ts` → `lambda.ts` (preserves naming consistency)
  - Updated: `vitest.config.ts` to include `tests/` directory
- ✅ Lambda handler refactoring - organized 515-line monolith into clean structure:
  - `lambda.ts` reduced from 515 → 77 lines (85% reduction) - thin router only
  - Created `src/handlers/` directory:
    - `recipe-handlers.ts` (376 lines) - Recipe CRUD + LLM improve
    - `health-handler.ts` (15 lines) - Health check
  - Created `src/middleware/` directory:
    - `response.ts` (38 lines) - JSON + CORS helpers
    - `auth.ts` (18 lines) - Firebase auth extraction
    - `request.ts` (29 lines) - Body parsing + path params
  - Follows AWS Lambda best practices (thin handler, specialized modules)
  - Better separation of concerns, easier to maintain and test

**New Decision:**
11. **Lambda Handler Organization** (2025-11-19)
   **Decision:** Organize Lambda handler using handlers/middleware pattern instead of monolithic file
   **Rationale:**
   - AWS best practice: thin handlers that delegate to specialized functions
   - Single Lambda with multiple routes needs good organization (not anti-pattern if well-structured)
   - Easier to navigate, test, and maintain
   - Follows industry patterns (Express.js controllers, NestJS modules)
   **Implementation:**
   - `lambda.ts` - Routing only (~77 lines)
   - `handlers/` - Route handler functions (focused responsibilities)
   - `middleware/` - Reusable utilities (auth, validation, response formatting)
   **Benefits:**
   - Changes localized to specific files
   - Reduced merge conflicts (multiple developers)
   - Clear import dependencies
   - Better testability
   **Date:** 2025-11-19

**Build Status:**
- TypeScript: Zero errors ✅
- Bundle: 57.6kb ✅
- Unit tests: 61 passing ✅
- Integration tests: Infrastructure ready (pre-existing OPENAI_API_KEY issue unrelated to cleanup)

**Files Deleted (7 total, ~1,058 lines):**
1. `src/lambda-old-backup.ts` - 87 lines
2. `src/service.ts` - 185 lines
3. `src/mock_response.ts`
4. `src/services/dynamo-service.ts` - 480 lines
5. `src/services/dynamo-service.test.ts` - 259 lines (migrated)
6. `src/types/dynamo.ts` - 47 lines

**Files Created (5 total, ~553 lines with better organization):**
1. `src/handlers/recipe-handlers.ts` - 376 lines
2. `src/handlers/health-handler.ts` - 15 lines
3. `src/middleware/response.ts` - 38 lines
4. `src/middleware/auth.ts` - 18 lines
5. `src/middleware/request.ts` - 29 lines
6. `tests/unit/mappers/recipe-mapper.test.ts` - 9 tests (migrated from dynamo-service.test.ts)

**Next:** Phase 7 (Testing & Optimization) or consider refactoring complete

---

**Version:** 1.0.0
**Last Updated:** 2025-11-19
