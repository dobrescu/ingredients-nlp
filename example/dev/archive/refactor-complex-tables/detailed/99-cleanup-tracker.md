# Cleanup Tracker - Refactor Complex Tables

**Purpose:** Track all code that gets replaced during Phases 1-5 for removal in Phase 6

**Last Updated:** 2025-11-19

**Status:** ✅ PHASE 6 COMPLETE - ALL LEGACY CODE REMOVED

---

## Summary

**Cleanup Complete:**
- ✅ Deleted 7 legacy files (~1,058 lines)
- ✅ Refactored Lambda handler (515 → 77 lines, 85% reduction)
- ✅ Migrated tests (9 tests from dynamo-service.test.ts → recipe-mapper.test.ts)
- ✅ Verified zero orphaned imports
- ✅ Build successful (57.6kb, zero errors)
- ✅ All 61 tests passing

**Files Deleted:**
1. `src/lambda-old-backup.ts` (87 lines)
2. `src/service.ts` (185 lines)
3. `src/mock_response.ts`
4. `src/services/dynamo-service.ts` (480 lines)
5. `src/services/dynamo-service.test.ts` (259 lines)
6. `src/types/dynamo.ts` (47 lines)

**Files Created:**
1. `src/handlers/recipe-handlers.ts` (376 lines)
2. `src/handlers/health-handler.ts` (15 lines)
3. `src/middleware/response.ts` (38 lines)
4. `src/middleware/auth.ts` (18 lines)
5. `src/middleware/request.ts` (29 lines)
6. `tests/unit/mappers/recipe-mapper.test.ts` (migrated 9 tests)

---

## Code Removed (Phase 6 - COMPLETE)

### Phase 1: Foundation - Recipe Utils Refactoring

**Status:** ✅ Refactoring complete (Phase 1 complete)

**Old code DELETED (already removed during Phase 1):**
- [x] `src/utils/recipe-utils.ts` - **REPLACED** by modular `src/utils/recipe/` structure
  - OLD: Single monolithic file with all recipe utilities
  - NEW: Modular structure with field-config.ts (DRY), wrap.ts, unwrap.ts, validate.ts, normalize.ts
  - **Status:** File already deleted during Phase 1 refactoring ✓

---

### Phase 2: Markdown Conversion

**Status:** ✅ New service created (Phase 2 complete)

**No old code to delete:**
- `src/services/markdown-conversion-service.ts` is a NEW service
- `src/services/recipe-converter.ts` serves different purpose (EnhancedRecipePage → RecipeExtractionInput, NOT markdown conversion)
- No overlap, no cleanup needed

---

### Phase 3: Database Layer - Repository Pattern

**Status:** ✅ New architecture implemented (Phase 3 complete)

#### DynamoService (src/services/dynamo-service.ts)

**Old methods DELETED:**
- [x] `saveRecipe(url, recipePage)` - **REPLACED** by `RecipeService.saveRecipe()` + RecipeRepository
- [x] `getRecipeByUrl(url)` - **REPLACED** by `RecipeRepository.getSharedRecipe(urlHash)`
- [x] `getRecipeById(recipeId)` - **REPLACED** by `RecipeRepository.getSharedRecipe()` / `getUserRecipe()`
- [x] `isCacheFresh(recipe)` - **NO LONGER NEEDED** (ManagedField tracks timestamps via history)
- [x] `convertToBaseRecipe(url, recipePage, existingCreatedAt)` - **REPLACED** by `RecipeMapper.toStoredRecipe()`

**New ManagedRecipe methods DELETED (Phase 3):**
- [x] `getSharedRecipe(urlHash)` (lines 187-213) - **REPLACED** by `RecipeRepository.getSharedRecipe()`
- [x] `getUserRecipe(firebaseUID, urlHash)` (lines 221-241) - **REPLACED** by `RecipeRepository.getUserRecipe()`
- [x] `putSharedRecipe(recipe)` (lines 247-262) - **REPLACED** by `RecipeRepository.putSharedRecipe()`
- [x] `putUserRecipe(firebaseUID, urlHash, recipe)` (lines 270-289) - **REPLACED** by `RecipeRepository.putUserRecipe()`
- [x] `updateUserField(...)` (lines 298-334) - **REPLACED** by `RecipeRepository.updateUserField()`
- [x] `updateSharedField(...)` (lines 342-377) - **REPLACED** by `RecipeRepository.updateSharedField()`
- [x] `serializeManagedRecipe()` private method (lines 385-416) - **REPLACED** by `RecipeMapper.toStoredRecipe()`
- [x] `deserializeStoredRecipe()` private method (lines 422-441) - **REPLACED** by `RecipeMapper.toManagedRecipe()`
- [x] `mergeUserAndBaseline()` exported function (lines 453-479) - **REPLACED** by `RecipeMapper.mergeUserAndBaseline()`

**Result:** Entire file `src/services/dynamo-service.ts` DELETED (480 lines)

**Reason:** All functionality moved to clean Repository pattern:
- `src/mappers/recipe-mapper.ts` (108 lines) - Serialization
- `src/repositories/recipe-repository.ts` (146 lines) - Data access
- `src/services/recipe-service.ts` (96 lines) - Business logic

**Status:** ✅ New architecture implemented (Phase 3 complete)

---

### Type Definitions (src/types/dynamo.ts)

**Types DELETED:**
- [x] `BaseRecipe` interface - Only used by deleted DynamoService
- [x] `DynamoSaveRequest` interface - Only used by deleted DynamoService
- [x] `DynamoOperationResult` interface - Only used by deleted DynamoService
- [x] `DynamoErrorType` enum - Only used by deleted DynamoService

**Result:** Entire file `src/types/dynamo.ts` DELETED (47 lines)

**Reason:** New architecture uses ManagedRecipe, StoredRecipe types (StoredRecipe moved to recipe-repository.ts)

---

### Phase 4: API Endpoints - RESTful Handler

**Status:** ✅ New handler implemented (Phase 4 complete)

#### Lambda Handler

**File DELETED:**
- [x] `src/lambda-old-backup.ts` (87 lines) - **REPLACED** by refactored `src/lambda.ts`
  - OLD: Query parameter-based routes (`/loadRecipe?url=...`, `/improveRecipe?recipeId=...`)
  - NEW: RESTful routes (`POST /recipe/load`, `GET /recipe/:urlHash`, `PUT /recipe/:urlHash`, `POST /recipe/:urlHash/improve`)
  - OLD: Monolithic 515-line handler
  - NEW: Thin 77-line router with handlers/middleware pattern

**Old handlers DELETED:**
- [x] `handleFetch()` - Replaced by `handleLoadRecipe()` in handlers/recipe-handlers.ts
- [x] `handleImproveRecipe()` - Replaced by `handleImproveRecipe()` in handlers/recipe-handlers.ts
- [x] `handleHealth()` - Replaced by `handleHealth()` in handlers/health-handler.ts
- [x] Main `handler()` function - Replaced by thin router in lambda.ts

#### Service Layer (src/service.ts)

**Entire File DELETED:**
- [x] `src/service.ts` (185 lines) - All functions replaced
- [x] `loadRecipe(url)` - **REPLACED** by RecipeService.getRecipe() + RecipeService.saveRecipe()
- [x] `improveRecipe(recipeId)` - **REPLACED** by new improve logic in handlers/recipe-handlers.ts using RecipeService
- [x] `toUserRecipe(recipe, url)` - **NO LONGER NEEDED** (SimplifiedRecipe mapping handles this)
- [x] `recipeExistsInS3(url)` - Functionality preserved via direct s3Service calls
- [x] `getRecipeFromS3(url)` - Functionality preserved via direct s3Service calls
- [x] `getAvailablePlugins(url)` - Functionality preserved via direct s3Service calls

**User Decision:** Utility functions like `getRecipeFromS3` are no longer needed as wrappers - direct s3Service calls are cleaner

**New architecture (Phase 4):**
- `src/handler.ts` (main Lambda handler) - RESTful routes, uses RecipeService
- `src/mappers/simplified-recipe-mapper.ts` - ManagedRecipe ↔ SimplifiedRecipe conversion
- `src/services/s3-service.ts` - Uses existing `saveRecipe()` method (no new methods added)

**Note:** Initial implementation attempted `storeHtml()/getHtml()` then `storeRecipeJson()/getRecipeJson()`, but both were removed in favor of using the existing `saveRecipe(url, prepperData)` which already stores the complete EnhancedRecipePage (fragments, plugins, recipes array). This matches the original service.ts behavior.

**Status:** ✅ New handler implemented, old code ready for removal

---

### Phase 5: LLM Integration

**Status:** ✅ Complete (Phase 5 complete)

**No code to delete** - LLM integration enhanced existing handlers with new logic, no old code replaced

---

### Tests

**Old tests DELETED/MIGRATED:**
- [x] `src/services/dynamo-service.test.ts` (259 lines) - **MIGRATED** to `tests/unit/mappers/recipe-mapper.test.ts`
  - Tests for `mergeUserAndBaseline()` function
  - Updated imports from `dynamo-service` to `recipe-mapper`
  - Added missing `actor` field to history entries
  - All 9 tests passing in new location
- [x] Updated `tests/integration/api-handlers.test.ts` - Changed import from `handler.js` to `lambda.js`
- [x] Mock support deleted: `src/mock_response.ts` (per user decision)

**Reason:** Tests for deleted code must be migrated or removed

---

### Imports and References

**Searches completed:**
- [x] `grep -r "from ['\"]\./lambda['\"]" src/` - Zero results ✅
- [x] `grep -r "from ['\"]\./service['\"]" src/` - Zero results ✅
- [x] `grep -r "DynamoService.*saveRecipe" src/` - Zero results ✅
- [x] `grep -r "DynamoService.*getRecipeByUrl" src/` - Zero results ✅
- [x] `grep -r "\bBaseRecipe\b" src/` - Zero results ✅
- [x] Verified no orphaned imports anywhere in codebase ✅

---

## Lambda Handler Refactoring (Phase 6 Bonus)

**Goal:** Apply AWS Lambda best practices to reduce handler size

**Completed:**
- [x] Renamed `src/handler.ts` → `src/lambda.ts` (user preferred naming)
- [x] Reduced main handler from 515 → 77 lines (85% reduction)
- [x] Created handlers/middleware pattern:
  - `src/handlers/recipe-handlers.ts` (376 lines) - All recipe route handlers
  - `src/handlers/health-handler.ts` (15 lines) - Health check
  - `src/middleware/response.ts` (38 lines) - Response formatting + CORS
  - `src/middleware/auth.ts` (18 lines) - Firebase authentication
  - `src/middleware/request.ts` (29 lines) - Request parsing
- [x] Pattern: thin router → handlers (validate → services → response) → services
- [x] Build successful, all tests passing

**Research:** Verified AWS Lambda best practices recommend thin handlers with focused delegation

---

## Final Status

**Phase 6 COMPLETE** ✅

**All objectives achieved:**
- ✅ Zero legacy code remaining
- ✅ Zero orphaned imports
- ✅ Clean architecture verified
- ✅ Build successful (57.6kb, zero errors)
- ✅ All 61 tests passing
- ✅ Lambda handler refactored with best practices
- ✅ Production-ready codebase

**Deferred (pending user approval):**
- Skills alignment review (skills should change deliberately with user input)
- Documentation updates (CLAUDE.md, README.md)

---

**Version:** 2.0.0
**Last Updated:** 2025-11-19
