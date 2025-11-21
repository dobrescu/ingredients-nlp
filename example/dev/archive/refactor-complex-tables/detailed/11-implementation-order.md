# Implementation Order

**Prerequisites:** All previous solution documents

---

## Purpose

This document provides **phased implementation plan** with clear milestones, testing checkpoints, and rollback points.

---

## Implementation Philosophy

**Approach:** Incremental, test-driven, with frequent validation.

**Principles:**
- Build foundation first (types, utilities)
- Implement one workflow at a time
- Test each component before integrating
- Deploy in phases with rollback capability
- No big-bang releases

**Timeline:** 2-3 weeks for full implementation (with testing)

---

## Phase 1: Foundation (Days 1-3)

**Goal:** Set up data models, utilities, and infrastructure without touching existing code.

### Tasks

**1.1 Install Dependencies**
- Run: `npm install unified remark-parse mdast-util-to-string unist-util-visit canonical-json`
- Verify installations
- Update tsconfig.json for ESM if needed
- **Checkpoint:** `npm list` shows all packages installed

**1.2 Create Type Definitions**
- Create `src/types/recipe/managed-recipe.ts`:
  - `ManagedField<T>` interface
  - `ManagedRecipe` interface
  - `StoredRecipe` interface
  - Helper types (`FieldName`, `ImprovementRequest`, etc.)
- Add to `src/types/index.ts` exports
- **Checkpoint:** TypeScript compilation succeeds

**1.3 Implement ContentHashService**
- Create `src/services/content-hash-service.ts`
- Implement `hashContent(value: any): Promise<string>`
- Implement `compareHashes(hash1, hash2): boolean`
- Write unit tests (hash stability, distinctness)
- **Checkpoint:** All tests pass

**1.4 Create Markdown Conversion Service (Bidirectional)**
- Create `src/services/markdown-conversion-service.ts`:
  - **HTML→Markdown:** `convertHtmlToMarkdown(value: string): string` - Inline HTML conversion
  - **HTML→Markdown Recipe:** `convertRecipeHtmlToMarkdown(recipe: RecipeJsonLd): RecipeJsonLd`
  - **JSON-LD→Kassi:** `toKassiFormat(recipe: ManagedRecipe): KassiRecipe` - Flat markdown strings
  - **Kassi→JSON-LD:** `fromKassiFormat(kassi: KassiRecipe): RecipeJsonLd` - Parse markdown to structure
  - Handle: HowToSection→markdown headings, string[]→markdown lists
  - Version: `readonly version = '1.0.0'` (matches markdownVersion field)
- Write unit tests:
  - HTML→MD conversion accuracy (bold, italic, links)
  - JSON-LD→Kassi→JSON-LD round-trip
  - HowToSection parsing with headings
  - Ingredient list parsing
- **Checkpoint:** All conversion tests pass

**1.5 Create Utility Functions**
- Create `src/utils/recipe-utils.ts`:
  - `wrapRecipe(raw, hashService): Promise<ManagedRecipe>`
  - `unwrapRecipe(managed): UnwrappedRecipe`
  - `validateManagedRecipe(obj): asserts obj is ManagedRecipe`
  - `normalizeUrl(url): string`
  - `parseIsoDuration(iso): string` and reverse
  - **`pruneHistory(field: ManagedField): ManagedField`** - Keep last 20 entries
- Write unit tests
- **Checkpoint:** All utility tests pass

**Deliverable:** Core types and utilities ready, fully tested, zero impact on existing API.

**Time:** 3 days

---

## Phase 2: Markdown Conversion (Days 4-6)

**Goal:** Implement bidirectional Markdown ↔ JSON-LD conversion.

### Tasks

**2.1 Implement RecipeMarkdownService**
- Create `src/services/recipe-markdown-service.ts`
- Implement `recipeToMarkdown(recipe): string`
  - Build Markdown template
  - Handle all field types
  - Convert inline HTML to Markdown
- Write unit tests (all fields, edge cases)
- **Checkpoint:** JSON-LD → Markdown works for sample recipes

**2.2 Implement Markdown Parsing**
- Implement `markdownToRecipe(markdown, metadata): Promise<ManagedRecipe>`
  - Set up unified + remark-parse
  - Traverse AST to extract sections
  - Convert to typed values
  - Wrap in ManagedField
- Write unit tests (all sections, malformed Markdown)
- **Checkpoint:** Markdown → JSON-LD works for sample recipes

**2.3 Round-Trip Testing**
- Test: JSON-LD → Markdown → JSON-LD produces identical structure
- Test all field types
- Test edge cases (null, empty arrays, special characters)
- **Checkpoint:** 100% round-trip success rate

**Deliverable:** RecipeMarkdownService fully functional and tested.

**Time:** 3 days

---

## Phase 3: Database Layer (Days 7-9)

**Goal:** Implement DynamoDB operations for new schema without breaking existing data.

### Tasks

**3.1 Extend DynamoService**
- Add methods to existing `src/services/dynamo-service.ts`:
  - `getSharedRecipe(urlHash): Promise<ManagedRecipe | null>`
  - `getUserRecipe(firebaseUID, urlHash): Promise<StoredRecipe | null>`
  - `putSharedRecipe(recipe: ManagedRecipe): Promise<void>`
  - `putUserRecipe(firebaseUID, urlHash, recipe): Promise<void>`
  - `updateUserField(firebaseUID, urlHash, fieldName, field): Promise<void>`
- Use new key patterns (`recipe#...`, `user#...`)
- **Checkpoint:** All new methods implemented

**3.2 Implement Record Merging**
- Create `mergeUserAndBaseline(userRecord, baselineRecord): ManagedRecipe`
- Handle null user record (user hasn't customized)
- Test various merge scenarios
- **Checkpoint:** Merge logic tested with sample data

**3.3 Test Against Real DynamoDB**
- Create test table (separate from production)
- Write integration tests:
  - Store and retrieve shared recipe
  - Store and retrieve user recipe
  - Merge user + baseline
- **Checkpoint:** All database operations work in test environment

**Deliverable:** Database layer ready for new schema, existing data untouched.

**Time:** 3 days

---

## Phase 4: API Endpoints (Days 10-12)

**Goal:** Implement new API endpoints alongside existing ones (parallel deployment).

### Tasks

**4.1 Implement Load Recipe Endpoint**
- Create/update `POST /api/recipe/load`:
  - Authenticate user (Firebase)
  - Normalize URL, compute hash
  - Check shared cache
  - If miss: scrape, convert, store
  - Return ManagedRecipe
- Add Firebase auth middleware if not present
- Write integration tests
- **Checkpoint:** Can load recipes via new endpoint

**4.2 Implement Get Recipe Endpoint**
- Create/update `GET /api/recipe/:urlHash`:
  - Fetch user record + shared baseline
  - Merge
  - Return ManagedRecipe
- Write integration tests
- **Checkpoint:** Can retrieve recipes with user customizations

**4.3 Implement Update Recipe Endpoint**
- Create/update `PUT /api/recipe/:urlHash`:
  - Detect changed fields (hash comparison)
  - Store in user record
  - Return updated recipe + changed field names
- Write integration tests
- **Checkpoint:** Can update recipes and persist changes

**4.4 Add S3 HTML Storage**
- Extend S3Service:
  - `storeHtml(urlHash, html): Promise<void>`
  - `getHtml(urlHash): Promise<string | null>`
- Store HTML when loading recipe (step 4.1)
- **Checkpoint:** HTML stored in S3 on recipe load

**Deliverable:** Basic CRUD operations working end-to-end.

**Time:** 3 days

---

## Phase 5: LLM Integration (Days 13-15)

**Goal:** Implement smart cache update logic with recipe-extras prompt.

### Tasks

**5.1 Extend BasePromptService**
- Update `src/prompts/base-prompt-service.ts`:
  - Add `abstract readonly inputFields: FieldName[]` property
  - Add USE_AI flag check: Return `{ skipped: true }` if `process.env.USE_AI !== 'true'`
- Update existing prompt services to declare inputFields:
  - `HeadlineGenerationService`: `inputFields = ['name', 'description']`
  - `RecipeExtrasService`: `inputFields = []` (reads only raw HTML)
- **Checkpoint:** All prompt services declare inputFields and check USE_AI

**5.2 Implement Smart Cache Update Logic**
- Update existing `improveRecipe()` in `src/service.ts`:
  - Get recipe from cache (merge user + baseline)
  - Get raw HTML from S3
  - Call `RecipeExtrasService.extractExtras()` with raw HTML
    - **Note:** Service handles HTML obfuscation internally using `HtmlReplacementService`
    - Already implemented in current codebase - no changes needed
  - Determine cache update routing:
    - Check if fields have user history (`field.history.some(h => h.source === 'user')`)
    - If no user history: Update shared cache for unmodified fields
    - If has user history: Skip shared cache update
  - For each extracted field:
    - Add history entry with `source='llm'`, `llmModel`, `promptVersion`
    - Hash to detect changes
    - ALWAYS update user record
    - CONDITIONALLY update shared cache (only if no user history)
- **Checkpoint:** Smart routing logic implemented

**5.3 Implement Improve Endpoint**
- Update `POST /api/recipe/:urlHash/improve`:
  - Extract firebaseUID from API Gateway JWT claims
  - No request body needed (auto-runs recipe-extras)
  - Call improved `improveRecipe(urlHash, firebaseUID)`
  - Return updated recipe + field changes
- Write integration tests (mock LLM responses)
- **Checkpoint:** Endpoint works with mocked LLMs

**5.4 Test with Real LLM**
- Test with Bedrock (default)
- Test with ChatGPT (optional)
- Verify cache update routing:
  - Field with no user history → updates shared cache ✓
  - Field with user history → skips shared cache ✓
- Verify HTML obfuscation (already implemented):
  - Check that `HtmlReplacementService` is being called
  - Verify `<a>` and `<img>` tags are simplified before LLM
  - Token count should be reduced
- Test USE_AI=false flag (all prompts skip)
- **Checkpoint:** Real LLM improvements working with smart caching and HTML obfuscation

**Deliverable:** Full improvement workflow with cache update routing functional.

**Time:** 3 days

---

## Phase 6: Migration (Days 16-17)

**Goal:** Migrate existing BaseRecipe data to ManagedRecipe format.

### Tasks

**6.1 Create Migration Script**
- Create `scripts/migrate-to-managed-recipe.ts`
- Implement conversion logic
- Add validation and error handling
- Add progress reporting
- Write dry-run mode
- **Checkpoint:** Script runs successfully in dry-run

**6.2 Test Migration**
- Run migration on staging environment
- Verify record counts match
- Test sample records for correctness
- Verify API works with migrated data
- **Checkpoint:** Staging migration successful

**6.3 Production Migration**
- Backup production data
- Schedule maintenance window
- Run migration script
- Verify success
- Deploy new API code
- Resume traffic
- **Checkpoint:** Production migration complete

**Deliverable:** All data migrated to new schema.

**Time:** 2 days

---

## Phase 7: Testing & Optimization (Days 18-20)

**Goal:** Comprehensive testing and performance optimization.

### Tasks

**7.1 Integration Testing**
- Test all workflows end-to-end:
  - Load new recipe → Get → Update → Improve
  - Multiple users, same recipe (shared cache)
  - Edge cases (missing fields, errors, timeouts)
- **Checkpoint:** All integration tests pass

**7.2 Error Handling & Resilience**
- Test failure scenarios:
  - DynamoDB throttling
  - S3 unavailable
  - LLM timeouts
  - Malformed requests
- Verify graceful degradation
- Check logs for useful error messages
- **Checkpoint:** All error paths handled

**Deliverable:** Production-ready system
**Time:** 3 days

---

## Phase 8: Documentation & Handoff (Day 21)

**Goal:** Complete documentation for maintenance and future development.

### Tasks

**8.1 Update API Documentation**
- Document all endpoints (request/response formats)
- Add authentication requirements
- Include example requests/responses
- Document error codes

**8.2 Create Runbooks**
- Deployment procedure
- Rollback procedure
- Common troubleshooting
- Migration procedure (for future reference)

**8.3 Code Documentation**
- Ensure all public functions have JSDoc comments
- Add inline comments for complex logic
- Update README.md

**Deliverable:** Complete documentation.

**Time:** 1 day

---

## Testing Strategy Summary

### Unit Tests (Throughout Implementation)
- Test each service method in isolation
- Mock external dependencies (DynamoDB, S3, LLM)
- Aim for 80%+ code coverage

**Run:** `npm test`

### Integration Tests (After Each Phase)
- Test API endpoints with real database (test environment)
- Verify data flows through entire stack
- Use test fixtures for consistent results

**Run:** `npm run test:integration`

### Load Tests (Phase 7)
- Simulate production traffic
- Identify bottlenecks
- Verify autoscaling works

**Run:** `npm run load-test`

### Manual Testing (Before Production)
- Test in staging with production-like data
- User acceptance testing (UAT)
- Security review

---

## Rollback Procedures

### Phase 4-5 Rollback (New API Endpoints)
**If issues found:**
1. Revert to previous Lambda deployment
2. Old endpoints still functional
3. New data remains in database (no harm)

### Phase 6 Rollback (Migration)
**If migration fails:**
1. Stop migration script
2. Run rollback script (restore from `legacy#` or backup)
3. Redeploy old API code
4. Investigate issues, fix, retry

### Phase 7 Rollback (Production Traffic)
**If production issues:**
1. Revert Lambda to previous version
2. Database has both schemas (no data loss)
3. Re-migrate later after fixes

---

## Risk Mitigation

### High-Risk Areas

**1. ESM Migration (unified v11)**
- **Risk:** Breaking existing CommonJS code
- **Mitigation:** Use dynamic imports initially, full ESM migration later

**2. DynamoDB Migration**
- **Risk:** Data loss or corruption
- **Mitigation:** Comprehensive backups, dry-run testing, staged rollout

**3. LLM Costs**
- **Risk:** Unexpectedly high API costs
- **Mitigation:** Rate limiting, cost monitoring, prompt optimization

**4. Hash Stability**
- **Risk:** Hash changes break change detection
- **Mitigation:** Extensive testing of canonical-json, version pinning

---

## Success Criteria

### Phase Completion Checklist

**Phase 1:**
- [ ] All types defined
- [ ] ContentHashService tested
- [ ] Utility functions tested
- [ ] Zero impact on existing API

**Phase 2:**
- [ ] Markdown conversion works both directions
- [ ] Round-trip tests pass
- [ ] Edge cases handled

**Phase 3:**
- [ ] New DynamoDB methods implemented
- [ ] Merge logic tested
- [ ] Integration tests pass

**Phase 4:**
- [ ] Load, Get, Update endpoints working
- [ ] S3 HTML storage functional
- [ ] Integration tests pass

**Phase 5:**
- [ ] Prompts defined for all fields
- [ ] ImprovementService working
- [ ] Parallel execution confirmed
- [ ] Real LLM tests pass

**Phase 6:**
- [ ] Migration script tested
- [ ] Staging migration successful
- [ ] Production migration complete

**Phase 7:**
- [ ] All integration tests pass
- [ ] Load tests meet performance targets

**Phase 8:**
- [ ] Documentation complete
- [ ] Runbooks created
- [ ] Code review passed

---

## Timeline Overview

| Phase | Duration | Days | Deliverable |
|-------|----------|------|-------------|
| 1. Foundation | 3 days | 1-3 | Types, utilities, hashing |
| 2. Markdown Conversion | 3 days | 4-6 | Bidirectional conversion |
| 3. Database Layer | 3 days | 7-9 | New DynamoDB operations |
| 4. API Endpoints | 3 days | 10-12 | Load, Get, Update |
| 5. LLM Integration | 3 days | 13-15 | Batch improvements |
| 6. Migration | 2 days | 16-17 | Data migration |
| 7. Testing & Optimization | 3 days | 18-20 | Production-ready |
| 8. Documentation | 1 day | 21 | Handoff materials |
| **Total** | **21 days** | **~3 weeks** | **Complete system** |

**Note:** Timeline assumes one developer working full-time. Adjust for team size and availability.

---

## Daily Standup Template

**What was completed yesterday:**
- List completed tasks

**What will be done today:**
- List planned tasks

**Blockers:**
- Any impediments

**Testing status:**
- Tests written: X/Y
- Tests passing: X/Y

**Next checkpoint:**
- Describe next validation point

---

## Summary

**Implementation approach:**
- ✅ Incremental (one phase at a time)
- ✅ Test-driven (validate before proceeding)
- ✅ Reversible (rollback at each phase)
- ✅ Low-risk (parallel deployment, staged migration)

**Total timeline:** 3 weeks (21 days)

**Key milestones:**
- Week 1: Foundation + Markdown + Database
- Week 2: API + LLM
- Week 3: Migration + Testing + Docs

**Ready for implementation!** 🚀
