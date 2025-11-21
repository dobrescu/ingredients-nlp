# Solution Overview

**Prerequisites:** Read [Premise.md](../Premise.md) first
**Next:** [Data Models](./02-data-models.md)

---

## Purpose

This document explains the architectural decisions and design philosophy behind the **Lightweight Field Envelope** solution for managing recipe data with per-field storage routing, change detection, and LLM-driven improvements.

---

## Core Problem

We need to:
1. **Store recipes in a shared cache** (DynamoDB) to avoid re-scraping identical content
2. **Track per-field edits** so users can customize recipes while preserving shared baseline
3. **Route storage intelligently**: edited fields go to user storage (DynamoDB), unedited fields reference shared cache (S3 for LLM context)
4. **Detect changes reliably** using content hashes to trigger LLM improvements or storage updates
5. **Support batch LLM improvements** across multiple fields in parallel

---

## Why This Solution?

### Rejected Approaches

**Option 1: Separate Storage Only**
Store shared baseline in S3, user edits in DynamoDB. Problem: no way to detect which fields changed without hashing anyway.

**Option 2: Heavy Field Envelope**
Wrap every field with full history, AST, canonical strings. Problem: over-engineered, massive storage overhead, complex to maintain.

### Chosen Approach: Lightweight Field Envelope

Wrap every field in a simple `ManagedField<T>` that tracks:
- **value**: The actual content (string, array, object) in JSON-LD canonical structure
- **rendered**: Display representation (markdown for Kassi)
- **currentHash**: Content hash for change detection
- **baseHash**: Hash of original unimproved version (enables improvement reuse)
- **history**: Edit history tracking all modifications with source, timestamps, and LLM metadata

**Benefits:**
- ✅ **Uniform**: Every field has same structure → simple code
- ✅ **Minimal**: Core properties + pruned history (last 20 entries) → low storage cost
- ✅ **Hash-stable**: Deterministic hashing → reliable change detection
- ✅ **Auditable**: Full history trail with LLM model/prompt versions for debugging
- ✅ **Flexible**: Can evolve schema without breaking existing data

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                          Client (Kassi)                         │
│  - Sends full recipe objects (not partial)                      │
│  - Calls improveRecipe() for batch field improvements           │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Express API (Lambda)                      │
│  - Firebase Auth → firebaseUID                                  │
│  - Routes: loadRecipe, getRecipe, updateRecipe, improveRecipe   │
└────────────────────┬────────────────────────────────────────────┘
                     │
         ┌───────────┴────────────┐
         ▼                        ▼
┌──────────────────┐    ┌──────────────────────┐
│   DynamoDB       │    │    S3 Bucket         │
│  (Single Table)  │    │  (HTML Fragments)    │
├──────────────────┤    ├──────────────────────┤
│ Shared Cache:    │    │ recipe-<urlHash>.html│
│  PK: recipe#hash │    │                      │
│  SK: base        │    │ Used for LLM context │
│                  │    │ when improving       │
│ User Records:    │    │ baseline fields      │
│  PK: user#uid    │    └──────────────────────┘
│  SK: recipe#hash │
└──────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Core Services                              │
│  - RecipeMarkdownService: JSON-LD ↔ Markdown                    │
│  - ContentHashService: Deterministic hashing                    │
│  - ImprovementService: Parallel LLM calls                       │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LLM Providers                                │
│  - Bedrock (default)                                            │
│  - ChatGPT (optional)                                           │
│  - Per-field prompt templates                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Design Decisions

### 1. Uniform Field Wrapping

**Decision:** Every field (string, array, object) uses `ManagedField<T>`.

**Rationale:**
- Simplifies type system: no special cases
- Enables generic helper functions
- Makes refactoring safer (TypeScript catches missing wrappers)

**Trade-off:** Slight verbosity (`field.value` instead of `field`), but worth it for consistency.

### 2. Hash-Based Change Detection

**Decision:** Use deterministic content hashing (SHA-256 of canonical JSON).

**Rationale:**
- Reliable: same content → same hash, always
- Efficient: compare hashes instead of deep object equality
- Provenance: know exactly when field changed

**Libraries:**
- `canonical-json`: Ensures stable JSON serialization
- `crypto.createHash('sha256')`: Fast, built-in

### 3. Batch Improvements

**Decision:** `improveRecipe()` accepts `fieldNames: string[]` and processes in parallel.

**Rationale:**
- User wants to improve multiple fields at once → faster UX
- LLM calls are I/O-bound → parallel execution is 5-10x faster
- Graceful degradation: one field fails, others succeed

**Implementation:** `Promise.all()` with per-field error handling.

### 4. Two-Tier Storage

**Decision:** Shared cache in DynamoDB, user edits in DynamoDB, raw HTML in S3.

**Rationale:**
- DynamoDB: fast key-value lookups for structured data
- S3: cheap storage for large HTML (used only for LLM context)
- Partition strategy: `recipe#<urlHash>` and `user#<firebaseUID>` enable efficient queries

### 5. Markdown as Intermediate Format

**Decision:** Convert JSON-LD → Markdown → User edits → JSON-LD.

**Rationale:**
- Markdown is human-readable and LLM-friendly
- Preserves structure (headings, lists) better than plain text
- Bidirectional conversion maintains schema.org compliance

**Implementation:**
- Use standard Markdown parsing libraries for conversion
- Custom logic to map recipe fields to/from Markdown structure

---

## Tech Stack

### Core
- **Node.js 22.x** (AWS Lambda runtime)
- **TypeScript 5.x** (strict mode)
- **Express.js** (API routing)

### AWS
- **Lambda** (serverless compute)
- **DynamoDB** (NoSQL database)
- **S3** (object storage)

### Authentication
- **Firebase Auth** (JWT validation, firebaseUID extraction)

### Data Processing
- **Markdown parsing library** (e.g., unified + remark-parse)
- **canonical-json** (stable JSON serialization for hashing)

### LLM
- **AWS Bedrock** (default: Claude 3.5 Sonnet)
- **OpenAI API** (optional: GPT-4)

---

## Data Flow Summary

### Load Recipe (first time)
```
User URL → Prepper scrapes → Returns JSON-LD (text fields may contain HTML)
         → Chef converts HTML→Markdown in text fields
         → Save original JSON-LD to S3 (recipe.json)
         → Wrap in ManagedField<T> → Hash all fields
         → Store shared cache (DynamoDB with markdown) + raw HTML (S3)
         → If USE_AI=true: Call 'headline-generation' prompt
         → Return ManagedRecipe (with markdown) to client
```

### Get Recipe (existing)
```
firebaseUID + urlHash → Query DynamoDB for user record
                      → Merge with shared cache
                      → Return ManagedRecipe to client
```

### Update Recipe (user edits)
```
Client sends full ManagedRecipe → Compare hashes per field
                                → Detect changed fields
                                → Set modifications.userModified=true
                                → Preserve modifications.aiModified if already set
                                → Store in user record (DynamoDB)
                                → Return updated ManagedRecipe
```

### Improve Recipe (LLM batch)
```
Client calls POST /api/recipe/:urlHash/improve (no body)
         → Chef gets recipe from cache + raw HTML from S3
         → Extract URLs from HTML (see current behaviour how is done) (minimize LLM tokens)
         → Chef calls 'recipe-extras' prompt
         → Restore URLs in response
         → Extracts new fields from raw HTML (nutrition, storage, tips, etc.)
         → Merges extras into recipe
         → Hashes to detect changes
         → Set modifications.aiModified=true, preserve modifications.userModified
         → If !userModified: Update shared cache + user record
         → If userModified: Update user record only
         → Return updated ManagedRecipe
```

---

## Success Criteria

✅ **Correctness:** User edits never overwrite shared baseline
✅ **Efficiency:** No re-scraping when recipe exists in shared cache
✅ **Performance:** Batch LLM calls complete in <10s for 5 fields
✅ **Reliability:** Content hashes detect all meaningful changes
✅ **Maintainability:** Type-safe, well-documented, testable

---

## Next Steps

1. Read [Data Models](./02-data-models.md) for TypeScript interfaces
2. Read [Database Schema](./03-database-schema.md) for DynamoDB design
3. Read [Services](./04-services.md) for implementation details
