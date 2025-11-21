# Implementation Plan: Refactor Complex Tables (ManagedField Architecture)

**Task:** `refactor-complex-tables`
**Status:** Ready for implementation
**Created:** 2025-11-13
**Last Updated:** 2025-11-13

---

## Executive Summary

Refactor the recipe data model from simple `BaseRecipe` structure to a **field-envelope architecture** using `ManagedField<T>`. This enables per-field change detection, storage routing, edit history tracking, and intelligent cache updates for LLM-driven improvements.

**Core Innovation:** Wrap every recipe field in a metadata envelope that tracks:
- Content hashes (change detection)
- Edit history (user vs AI modifications)
- Rendered formats (JSON-LD + Markdown)
- Storage routing (shared cache vs user-specific)

**Why:** Current architecture can't distinguish user edits from AI improvements, causing cache pollution and preventing intelligent improvement reuse across users.

**Outcome:** Users get faster recipe loading (cached improvements), better UX (edits preserved), and transparent AI enhancements.

---

## High-Level Architecture

### Before (Current)
```
BaseRecipe {
  name: string
  ingredients: string[]
  instructions: HowToStep[]
}
```
**Problems:**
- No change detection → can't tell what changed
- No history → can't distinguish user edits from AI
- No rendered formats → convert JSON↔Markdown on every request
- No storage routing → user edits pollute shared cache

### After (Target)
```
ManagedRecipe {
  name: ManagedField<string>
  recipeIngredient: ManagedField<string[]>
  recipeInstructions: ManagedField<HowToStep[]>
}

ManagedField<T> {
  value: T                    // Canonical JSON-LD
  rendered: { markdown, version }
  currentHash: string         // Change detection
  baseHash: string            // Improvement reuse key
  history: HistoryEntry[]     // User/AI edit trail
}
```
**Benefits:**
- ✅ O(1) change detection via hashing
- ✅ Storage routing based on edit history
- ✅ Cached markdown (no conversion overhead)
- ✅ Full audit trail with LLM metadata
- ✅ Improvement reuse across users (baseHash matching)

---

## Implementation Phases

### Phase 1: Foundation (3 days)
**Goal:** Types, utilities, hashing infrastructure

**Key Deliverables:**
- `ManagedField<T>` and `ManagedRecipe` TypeScript interfaces
- `ContentHashService` (deterministic SHA-256 hashing)
- Field wrapping/unwrapping utilities
- Unit tests for all core functions

**Detail:** See [detailed/11-implementation-order.md](./detailed/11-implementation-order.md#phase-1-foundation-days-1-3)

---

### Phase 2: Markdown Conversion (3 days)
**Goal:** Bidirectional JSON-LD ↔ Markdown

**Key Deliverables:**
- `RecipeMarkdownService` (convert fields to/from markdown)
- Preserve inline formatting (bold, italic, links)
- Handle complex structures (HowToSection, HowToStep)
- Round-trip tests (JSON → MD → JSON preserves structure)

**Detail:** See [detailed/11-implementation-order.md](./detailed/11-implementation-order.md#phase-2-markdown-conversion-days-4-6)

---

### Phase 3: Database Layer (3 days)
**Goal:** DynamoDB single-table design with field envelopes

**Key Deliverables:**
- New key patterns: `recipe#<urlHash>` + `user#<firebaseUID>`
- Shared cache records (improvement storage)
- User records (edited fields only)
- Record merging logic

**Detail:** See [detailed/11-implementation-order.md](./detailed/11-implementation-order.md#phase-3-database-layer-days-7-9)

---

### Phase 4: API Endpoints (3 days)
**Goal:** Load, Get, Update endpoints with new schema

**Key Deliverables:**
- `POST /api/recipe/load` - First-time recipe setup
- `GET /api/recipe/:urlHash` - Retrieve with merging
- `PUT /api/recipe/:urlHash` - Save user edits
- S3 HTML storage for LLM context

**Detail:** See [detailed/11-implementation-order.md](./detailed/11-implementation-order.md#phase-4-api-endpoints-days-10-12)

---

### Phase 5: LLM Integration (3 days)
**Goal:** Smart cache update routing for AI improvements

**Key Deliverables:**
- Improvement routing logic (check edit history)
- Update shared cache only if field unmodified by user
- Always update user record
- Track LLM model + prompt version in history

**Detail:** See [detailed/11-implementation-order.md](./detailed/11-implementation-order.md#phase-5-llm-integration-days-13-15)

---

### Phase 6: Migration (2 days)
**Goal:** Migrate existing BaseRecipe → ManagedRecipe

**Key Deliverables:**
- Migration script with dry-run mode
- Backup production data
- Staged rollout (staging → production)
- Validation checks

**Detail:** See [detailed/11-implementation-order.md](./detailed/11-implementation-order.md#phase-6-migration-days-16-17)

---

### Phase 7: Testing & Optimization (3 days)
**Goal:** Production-ready

**Key Deliverables:**
- Integration tests (all workflows)
- Load tests (performance validation)
- Error handling (resilience)

**Detail:** See [detailed/11-implementation-order.md](./detailed/11-implementation-order.md#phase-7-testing--optimization-days-18-20)

---

### Phase 8: Documentation (1 day)
**Goal:** Handoff materials

**Key Deliverables:**
- API documentation updates
- Runbooks (deployment, rollback, troubleshooting)
- Code documentation (JSDoc comments)

**Detail:** See [detailed/11-implementation-order.md](./detailed/11-implementation-order.md#phase-8-documentation--handoff-day-21)

---

## Timeline

**Total:** 21 days (~3 weeks)
- Week 1: Foundation + Markdown + Database (Phases 1-3)
- Week 2: API + LLM (Phases 4-5)
- Week 3: Migration + Testing + Docs (Phases 6-8)

**Approach:** Incremental, test-driven, reversible at each phase

---

## Key Design Decisions

### 1. Field Envelope Pattern
**Why:** Uniform metadata across all field types (string, array, object)
**Trade-off:** Slight verbosity (`field.value`) for consistency

### 2. Hash-Based Change Detection
**Why:** Reliable, efficient, enables deduplication
**Implementation:** SHA-256 of canonical JSON (not markdown)

### 3. Storage Routing Logic
**Rule:** Update shared cache ONLY if field has no user history entries
**Why:** Preserves user edits while enabling improvement reuse

### 4. Markdown as Intermediate Format
**Why:** Human-readable, LLM-friendly, preserves structure
**Caution:** Must parse back to JSON-LD server-side

### 5. History Pruning
**Limit:** Keep last 20 entries per field
**Why:** Manage DynamoDB item size (400KB limit)

---

## Success Criteria

✅ User edits never overwrite shared baseline
✅ No re-scraping when recipe exists in cache
✅ Batch LLM calls complete in <10s for 5 fields
✅ Content hashes detect all meaningful changes
✅ Type-safe, well-documented, testable

---

## Risk Mitigation

**High-Risk Areas:**
1. **DynamoDB Migration** → Comprehensive backups, dry-run testing, staged rollout
2. **Hash Stability** → Extensive testing of canonical-json, version pinning
3. **LLM Costs** → Rate limiting, cost monitoring, prompt optimization

**Rollback Points:** After each phase (API, migration, production)

---

## Detailed Documentation

All detailed specifications in `./detailed/`:

**Requirements & Architecture:**
- [00-premise.md](./detailed/00-premise.md) - Original problem statement, requirements
- [01-overview.md](./detailed/01-overview.md) - Architectural decisions, design philosophy
- [02-data-models.md](./detailed/02-data-models.md) - TypeScript interfaces (exact structures)
- [03-database-schema.md](./detailed/03-database-schema.md) - DynamoDB single-table design

**Implementation Guides:**
- [04-services.md](./detailed/04-services.md) - Service layer implementation
- [05-api-endpoints.md](./detailed/05-api-endpoints.md) - Express route handlers
- [06-workflows.md](./detailed/06-workflows.md) - End-to-end data flows
- [07-llm-integration.md](./detailed/07-llm-integration.md) - Bedrock/ChatGPT integration

**Conversion & Integration:**
- [08-markdown-conversion.md](./detailed/08-markdown-conversion.md) - Bidirectional conversion logic
- [12-kassi-integration.md](./detailed/12-kassi-integration.md) - React Native app contract

**Migration & Dependencies:**
- [09-migration.md](./detailed/09-migration.md) - Data migration script
- [10-dependencies.md](./detailed/10-dependencies.md) - NPM packages needed
- [11-implementation-order.md](./detailed/11-implementation-order.md) - Phase-by-phase task breakdown

---

## Next Steps

**Ready to implement!** Start with Phase 1 (Foundation).

See [tasks.md](./tasks.md) for implementation checklist.
See [context.md](./context.md) for key file locations and decisions.

---

**Version:** 1.0.0
**Last Updated:** 2025-11-13
