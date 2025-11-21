# 9. Migration Strategy

**Prerequisites:** [Data Models](./02-data-models.md), [Database Schema](./03-database-schema.md)
**Next:** [Dependencies](./10-dependencies.md)

---

## Overview

**Approach:** Clean break - no backward compatibility.

**Rationale:**
- Old `Recipe` type → deprecated, not migrated
- New `ManagedRecipe` is the standard going forward
- Existing data handled separately if needed (out of scope)

---

## What Changes

### Old Types (Deprecated)

```typescript
// src/types/recipe/recipe.ts - NO LONGER USED
type Recipe = {
  '@type': 'Recipe';
  name: string;
  description: string;
  // ... plain values
};

// src/types/recipe/user-recipe.ts - NO LONGER USED
type UserRecipe = Recipe & {
  id: string;
  urlHash: string;
  // ... metadata
};
```

### New Types (Standard)

```typescript
// src/types/recipe/managed-recipe.ts - NEW STANDARD
type ManagedRecipe = {
  name: ManagedField<string>;
  description: ManagedField<string>;
  ingredients: ManagedField<IngredientSection[]>;
  // ... all fields wrapped
  sourceUrl: string;
  urlHash: string;
};
```

---

## Database Schema Changes

### Old Schema (Deprecated)

**DynamoDB:**
```
PK: recipe#{urlHash}
SK: base
Attributes: { ...recipe fields as plain values }
```

### New Schema (Standard)

**DynamoDB:**
```
PK: recipe#{urlHash}
SK: base
Attributes: { ...recipe with ManagedField wrappers }

PK: user#{firebaseUID}
SK: recipe#{urlHash}
Attributes: { ...user-edited fields only }
```

**Migration:** None - start fresh with new schema.

---

## API Changes

### Old Endpoints (Deprecated)

```
GET /loadRecipe?url=...
GET /improveRecipe?recipeId=...
```

### New Endpoints (Standard)

```
POST /api/recipe/load
GET /api/recipe/:urlHash
PUT /api/recipe/:urlHash
POST /api/recipe/:urlHash/improve
```

**Migration:** Clients update to new endpoints.

---

## Implementation Steps

**1. Deploy new schema alongside old**
   - New DynamoDB GSI if needed
   - New S3 paths if needed
   - Old data untouched

**2. Update API to only handle ManagedRecipe**
   - Remove old type imports
   - Update all services to use ManagedRecipe
   - Deploy new Lambda

**3. Update Kassi client**
   - Call new endpoints
   - Handle ManagedRecipe format
   - Remove old code

**4. Deprecate old endpoints**
   - Return 410 Gone
   - Add deprecation notice

**5. (Optional) Archive old data**
   - Export to S3 for backup
   - Delete from DynamoDB
   - Out of scope for this implementation

---

## No Data Migration

**Why:** Clean break is simpler and faster.

**Implications:**
- Users start fresh when they load recipes
- Old recipe data not converted
- If user had saved recipes, they reload from source

**If migration needed later:**
- Write separate script
- Convert old Recipe → ManagedRecipe
- Wrap all fields with `source='scraped'`, `confidence=0.8`
- Update database records

---

## Summary

**Migration approach:** Clean break

**Steps:**
1. Deploy new schema and API
2. Update clients to new endpoints
3. Deprecate old endpoints
4. (Optional) Archive old data

**No backward compatibility:**
- Old Recipe type not supported
- Old data not migrated
- Users reload recipes as needed

**Next:** [Dependencies](./10-dependencies.md)
