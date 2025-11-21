# Solution Documentation Index

Complete implementation guide for the **Lightweight Field Envelope** recipe management system.

---

## 📋 Reading Order

Follow this sequence for complete understanding:

0. **[00-premise.md](./00-premise.md)** - Requirements and problem statement
   - Data formats & standards
   - System components
   - Key requirements
   - Success criteria

1. **[01-overview.md](./01-overview.md)** - Solution architecture
   - Architecture decisions
   - Why this solution
   - Tech stack overview
   - Data flow summary

2. **[02-data-models.md](./02-data-models.md)** - Core types
   - ManagedField<T> structure
   - ManagedRecipe interface
   - Supporting types
   - Conversion helpers

3. **[03-database-schema.md](./03-database-schema.md)** - Storage design
   - DynamoDB table structure
   - Partition key patterns
   - Query patterns
   - S3 integration

4. **[04-services.md](./04-services.md)** - Business logic
   - ContentHashService
   - RecipeMarkdownService
   - ImprovementService

5. **[05-api-endpoints.md](./05-api-endpoints.md)** - API routes
   - POST /api/recipe/load
   - GET /api/recipe/:urlHash
   - PUT /api/recipe/:urlHash
   - POST /api/recipe/:urlHash/improve

6. **[06-workflows.md](./06-workflows.md)** - Step-by-step flows
   - Load recipe workflow
   - Get recipe workflow
   - Update recipe workflow
   - Improve recipe workflow

7. **[07-llm-integration.md](./07-llm-integration.md)** - AI improvements
   - Prompt design
   - Parallel execution
   - Provider configuration
   - Error handling

8. **[08-markdown-conversion.md](./08-markdown-conversion.md)** - Format conversion
   - JSON-LD → Markdown
   - Markdown → JSON-LD
   - Inline formatting
   - Validation

9. **[09-migration.md](./09-migration.md)** - Data migration
   - Migration strategy
   - Conversion logic
   - Rollback plan
   - Validation

10. **[10-dependencies.md](./10-dependencies.md)** - Package requirements
    - New dependencies
    - Installation commands
    - ESM considerations

11. **[11-implementation-order.md](./11-implementation-order.md)** - Build sequence
    - 8-phase plan
    - Testing strategy
    - Timeline (3 weeks)
    - Success criteria

12. **[12-kassi-integration.md](./12-kassi-integration.md)** - Kassi ↔ Chef contract
    - Data format (Chef → Kassi)
    - Data format (Kassi → Chef)
    - API endpoint contracts
    - Markdown formatting rules
    - Simple, LLM-readable reference

---

## 🎯 Quick Navigation

### By Role

**Backend Developer:**
- Start: 01-overview, 02-data-models, 04-services
- Focus: 06-workflows, 11-implementation-order

**DevOps Engineer:**
- Start: 01-overview, 03-database-schema
- Focus: 09-migration, 10-dependencies, 11-implementation-order

**Project Manager:**
- Start: 01-overview
- Focus: 11-implementation-order (timeline and milestones)

### By Topic

**Data Model:**
- 02-data-models.md
- 03-database-schema.md

**API Implementation:**
- 04-services.md
- 05-api-endpoints.md
- 06-workflows.md

**LLM Features:**
- 07-llm-integration.md
- Existing: `src/prompts/`

**Format Conversion:**
- 08-markdown-conversion.md
- 12-kassi-integration.md

**Deployment:**
- 09-migration.md
- 10-dependencies.md
- 11-implementation-order.md

**Client Integration:**
- 12-kassi-integration.md (Kassi ↔ Chef contract)

---

## 📊 Document Status

| Document | Status | Last Updated |
|----------|--------|--------------|
| 00-premise.md | ✅ Complete | 2025-11-12 |
| 01-overview.md | ✅ Complete | 2025-11-10 |
| 02-data-models.md | ✅ Complete | 2025-11-10 |
| 03-database-schema.md | ✅ Complete | 2025-11-10 |
| 04-services.md | ✅ Complete | 2025-11-10 |
| 05-api-endpoints.md | ✅ Complete | 2025-11-10 |
| 06-workflows.md | ✅ Complete | 2025-11-10 |
| 07-llm-integration.md | ✅ Complete | 2025-11-10 |
| 08-markdown-conversion.md | ✅ Complete | 2025-11-10 |
| 09-migration.md | ✅ Complete | 2025-11-10 |
| 10-dependencies.md | ✅ Complete | 2025-11-10 |
| 11-implementation-order.md | ✅ Complete | 2025-11-10 |
| 12-kassi-integration.md | ✅ Complete | 2025-11-11 |

---

## 🔑 Key Concepts

**ManagedField<T>:**
- Wraps every recipe field
- Tracks: `value` (JSON-LD), `rendered` (markdown), `currentHash`, `baseHash`, `history[]`
- Enables change detection, improvement reuse, and storage routing

**Shared Cache:**
- DynamoDB: `PK=recipe#<hash>`, `SK=base`
- Stores baseline recipe data + improvements map
- Shared across all users

**User Records:**
- DynamoDB: `PK=user#<uid>`, `SK=recipe#<hash>`
- Stores only user-modified fields
- Merged with shared cache on read

**Improvement Reuse:**
- Improvements map keyed by `baseHash`
- Check cache before calling LLM (cost reduction)
- O(1) lookup via improvements map

**Storage Routing:**
- No user history → update shared cache improvements map + user record
- Has user history → update only user record

**Change Detection:**
- SHA-256 hash of canonical JSON (`value`)
- Compare `currentHash` with new hash
- O(1) complexity

**History Tracking:**
- Single source of truth (no redundant flags)
- Tracks: timestamp, hash, source, actor, llmModel, promptVersion
- Derived properties: `isUserEdited`, `isAiImproved` computed from history

---

## 📦 Implementation Summary

**Timeline:** 3 weeks (21 days)

**Phases:**
1. Foundation (days 1-3)
2. Markdown Conversion (days 4-6)
3. Database Layer (days 7-9)
4. API Endpoints (days 10-12)
5. LLM Integration (days 13-15)
6. Migration (days 16-17)
7. Testing & Optimization (days 18-20)
8. Documentation (day 21)

**Dependencies:**
- unified, remark-parse (Markdown processing)
- canonical-json (hash stability)
- mdast-util-to-string, unist-util-visit (AST utilities)

**New files to create:**
- `src/types/recipe/managed-recipe.ts`
- `src/services/content-hash-service.ts`
- `src/services/recipe-markdown-service.ts`
- `src/services/improvement-service.ts`
- `src/prompts/field-improvement/` (directory)
- `scripts/migrate-to-managed-recipe.ts`

---

## 🚀 Getting Started

**To begin implementation:**

1. Read [00-premise.md](./00-premise.md) for requirements
2. Read [01-overview.md](./01-overview.md) for architecture
3. Follow [11-implementation-order.md](./11-implementation-order.md) for step-by-step plan
4. Install dependencies from [10-dependencies.md](./10-dependencies.md)
5. Start Phase 1: Foundation

**Questions?** Refer to specific documents above or consult existing codebase in `src/`.

---

## 📖 Parent Task Documents

- **[../plan.md](../plan.md)** - High-level implementation plan
- **[../context.md](../context.md)** - Key files and decisions
- **[../tasks.md](../tasks.md)** - Implementation checklist

---

**All documents are implementation-ready with high-level directions (no full code implementations).** Ready to start Phase 1! 🎉
