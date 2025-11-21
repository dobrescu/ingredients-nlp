# Plan: Testing Framework Refactor

## Executive Summary

The current integration tests (24 tests across 3 files) use inline test data, complex mock utilities, and inconsistent patterns. This makes tests hard to maintain and extend. We're refactoring to a **fixture-based, workflow-focused testing framework** that follows KISS principles.

The new approach uses real data snapshots (fixtures) for inputs/outputs, simple helper functions for test data generation, and workflow-based tests that map 1:1 to API endpoints. This will make tests easier to understand, maintain, and extend while improving coverage with fewer, higher-quality tests.

## Goals & Non-Goals

**Goals:**
- [ ] Create a simple, fixture-based testing framework
- [ ] Migrate existing integration tests to new pattern
- [ ] Achieve better test coverage with fewer, meaningful tests (~12 core tests)
- [ ] Make it easy to add new test cases (add 2 fixture files = new test)
- [ ] Keep tests maintainable and easy to understand
- [ ] Document the approach in TESTING.md (simple, no fluff)

**Non-Goals:**
- Changing unit tests (tests/unit/ and src/*.test.ts remain untouched)
- Over-engineering with complex abstractions or classes
- Creating 50+ edge case tests (less is more if properly done)
- Adding visual diff tools or CI/CD changes (future work)

## Requirements

**Core Requirements:**
- [ ] Fixture organization: One fixture per workflow state, shared across tests
- [ ] Simple test helpers: `tests/helpers.ts` with buildEvent(), buildRecipe(), setupMocks()
- [ ] Four workflow test files: load-recipe, get-recipe, update-recipe, improve-recipe
- [ ] Each workflow test covers: happy path (cache hit/miss), error cases (401, 404, 400), 1 critical edge case
- [ ] Global mock setup in tests/setup.ts (DRY, no repetition)
- [ ] Clear separation: integration tests (tests/workflows/) vs unit tests (tests/unit/)
- [ ] Updated TESTING.md with simple, technical documentation

**Optional / Stretch:**
- [ ] .actual/ directory for debugging (save actual outputs, gitignored)
- [ ] Fixture generation script for creating new test cases
- [ ] Additional edge case coverage beyond the 12 core tests

## Architecture & Design

**Current State:**
- `tests/integration/api-handlers.test.ts` - 12 tests for HTTP routing/auth
- `tests/integration/llm-services.test.ts` - 6 tests for LLM services
- `tests/integration/recipe-workflows.test.ts` - 6 tests for workflows
- Complex helper functions: `createStoredRecipe()` (75 lines), `createAuthEvent()`
- Separate mock files: `tests/mocks/dynamodb-client.mock.ts`, etc.

**Planned Changes:**

1. **New Directory Structure:**
   ```
   tests/
   ├── fixtures/
   │   ├── events/              # API Gateway events
   │   ├── recipes/             # Recipes at different states
   │   ├── prepper/             # Prepper responses (existing)
   │   └── llm/                 # LLM responses (existing)
   ├── workflows/               # NEW: Workflow-based integration tests
   │   ├── load-recipe.test.ts
   │   ├── get-recipe.test.ts
   │   ├── update-recipe.test.ts
   │   └── improve-recipe.test.ts
   ├── unit/                    # UNCHANGED: Unit tests
   ├── helpers.ts               # NEW: Simple test utilities
   └── setup.ts                 # UPDATED: Global mock setup
   ```

2. **Key Services/Modules Involved:**
   - Lambda handlers (src/handlers/recipe-handlers.ts)
   - RecipeService (src/services/recipe-service.ts)
   - RecipeRepository (src/repositories/recipe-repository.ts)
   - Mappers (src/mappers/recipe-mapper.ts, simplified-recipe-mapper.ts)
   - All existing AWS mocks (DynamoDB, S3, Bedrock)

3. **Data Model Changes:**
   - No data model changes
   - Better test data representation via fixtures

4. **Testing Pattern:**
   - **Fixtures = Real data snapshots** (JSON files)
   - **Builders = Simple override functions** (helpers.ts)
   - **Global mocks = DRY setup** (tests/setup.ts)
   - **Workflow tests = 1:1 API endpoint mapping**

## Implementation Phases

### Phase 1: Foundation
**Purpose:** Create the basic infrastructure without changing existing tests

**Steps:**
1. Create `tests/helpers.ts` with three simple functions:
   - `buildEvent(overrides)` - Create API Gateway events
   - `buildRecipe(overrides)` - Create test recipes
   - `setupMocks()` - Global mock setup
2. Create `tests/fixtures/events/` directory
3. Create `tests/fixtures/recipes/` directory
4. Update `tests/setup.ts` to call `setupMocks()`

### Phase 2: Create Fixtures
**Purpose:** Generate real data snapshots for all workflows

**Steps:**
1. Run existing tests to capture actual responses
2. Create fixture files:
   - `events/load-recipe.json`, `get-recipe.json`, `update-recipe.json`, `improve-recipe.json`
   - `recipes/fresh-from-prepper.json`, `with-ai-improvements.json`, `user-customized.json`
3. Verify fixtures are valid JSON and represent real data

### Phase 3: Build Workflow Tests (Priority Order)
**Purpose:** Create new workflow tests one at a time

**Test 1: load-recipe.test.ts** (Highest priority)
- Happy path: cache miss (Prepper call → save to DynamoDB/S3 → return)
- Happy path: cache hit (DynamoDB lookup → return)
- Error: 401 unauthorized
- Error: 400 missing URL parameter
- Edge: Prepper failure

**Test 2: get-recipe.test.ts**
- Happy path: shared cache only
- Happy path: user customizations merged with baseline
- Error: 404 recipe not found
- Error: 401 unauthorized

**Test 3: update-recipe.test.ts**
- Happy path: update single field
- Happy path: update multiple fields
- Validation: changed fields detected
- Error: 401 unauthorized

**Test 4: improve-recipe.test.ts**
- Happy path: LLM improvement + merge
- Validation: user edits preserved
- Error: LLM service failure

### Phase 4: Migrate Existing Tests
**Purpose:** Aggressively refactor old tests to use new patterns

**Steps:**
1. Delete `tests/integration/api-handlers.test.ts` (replaced by workflow tests)
2. Delete `tests/integration/recipe-workflows.test.ts` (replaced by workflow tests)
3. Keep `tests/integration/llm-services.test.ts` (already good, minimal changes)
4. Delete complex mock files: `tests/mocks/dynamodb-client.mock.ts`, etc.
5. Verify all old test coverage is preserved in new workflow tests

### Phase 5: Documentation & Cleanup
**Purpose:** Document the new approach and clean up

**Steps:**
1. Update `TESTING.md` with:
   - Quick start commands
   - How to write tests (fixtures + builders)
   - Test structure explanation
   - Workflow test coverage
2. Add `.actual/` to `.gitignore` (optional debugging directory)
3. Remove unused fixtures or test utilities
4. Final test run to ensure everything passes

## Risks & Mitigations

**Risk:** Losing test coverage during aggressive migration
- **Impact:** High
- **Likelihood:** Medium
- **Mitigation:** Map old tests to new tests 1:1, verify coverage before deleting old tests

**Risk:** Over-simplifying and missing critical edge cases
- **Impact:** Medium
- **Likelihood:** Low
- **Mitigation:** Review existing tests for edge cases, include critical ones in workflow tests

**Risk:** New pattern not adopted by team
- **Impact:** Medium
- **Likelihood:** Low
- **Mitigation:** Keep it simple (KISS), document clearly, make it easy to use

**Risk:** Fixtures become stale or outdated
- **Impact:** Low
- **Likelihood:** Medium
- **Mitigation:** Fixtures are versioned in git, easy to update when schema changes

## Testing Strategy

**Workflow Tests** (tests/workflows/):
- Each test covers one API workflow end-to-end
- Uses fixtures for input/output data
- Uses builders for test-specific overrides
- Mocks AWS services (DynamoDB, S3, Bedrock)
- ~12 meaningful integration tests total

**Unit Tests** (tests/unit/ and src/):
- Unchanged
- Test pure functions (mappers, validators, utils)
- No mocks, no fixtures

**Manual Testing:**
- Run full test suite before and after migration
- Verify coverage hasn't decreased
- Test one workflow manually with dev-server

## Success Criteria

**Observable Behaviors:**
- [ ] All workflow tests pass (load, get, update, improve)
- [ ] Test coverage ≥ current coverage (no regression)
- [ ] Unit tests still pass (unchanged)
- [ ] New test can be added by creating 2 fixture files

**Concrete Checks:**
- [ ] `yarn test` passes all tests
- [ ] `yarn test:coverage` shows ≥ current coverage
- [ ] TESTING.md explains the new approach simply
- [ ] Team can understand and use new pattern without explanation

**Metrics:**
- Total tests: ~12 workflow tests + 6 LLM service tests + existing unit tests
- Fixture files: ~8-10 fixture files
- Test utilities: 1 file (helpers.ts) with ~3 functions
- Lines of test code: Reduced by ~30% while maintaining coverage

## Last Updated
2025-01-20T00:00:00.000Z
