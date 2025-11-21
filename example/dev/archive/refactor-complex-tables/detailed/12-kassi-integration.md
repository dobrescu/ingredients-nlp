# Kassi Integration Contract

**Context:** This document defines the data contract between Chef (API Backend) and Kassi (React Native App).

**Key Principle:** Kassi sees only **simple recipe objects with rendered markdown strings**. Kassi does not know about ManagedField wrappers, hashes, history, or internal metadata.

---

## Overview

**Chef's Role:**
- Stores recipes in ManagedField format internally (with JSON-LD, hashes, history)
- Converts to simple format for Kassi (extracts rendered markdown)
- Receives simple format from Kassi (parses markdown → JSON-LD → ManagedField)

**Kassi's Role:**
- Displays recipes with markdown rendering
- Allows users to edit markdown freely
- Sends full recipe object with all fields back to Chef

---

## Data Format: Chef → Kassi

### Recipe Object Structure

Chef sends a **flat object** with field names mapped to rendered markdown strings:

```json
{
  "name": "Chocolate Chip Cookies",
  "description": "These are the **best** chocolate chip cookies you'll ever make!",
  "recipeYield": "24 cookies",
  "prepTime": "15 minutes",
  "cookTime": "12 minutes",
  "totalTime": "27 minutes",
  "recipeCategory": "Dessert",
  "recipeCuisine": "American",
  "keywords": "cookies, chocolate, baking, dessert",

  "recipeIngredient": "- **2 cups** [all-purpose flour](https://example.com/flour)\n- 1 tsp baking soda\n- 1/2 tsp salt\n- 1 cup butter (softened)\n- 3/4 cup sugar\n- **2 large eggs**\n- 2 tsp vanilla extract\n- 2 cups chocolate chips",

  "recipeInstructions": "## Prepare Dough\n\n1. Preheat oven to **350°F** (175°C).\n2. Mix flour, baking soda, and salt in a bowl.\n3. In another bowl, cream together butter and sugars until fluffy.\n\n## Bake\n\n1. Drop rounded tablespoons of dough onto ungreased cookie sheets.\n2. Bake for **10-12 minutes** or until golden brown.\n3. Cool on baking sheet for 2 minutes before removing to a wire rack.",

  "nutrition": {
    "calories": "210",
    "fatContent": "11g",
    "carbohydrateContent": "27g",
    "proteinContent": "2g"
  },

  "aggregateRating": {
    "ratingValue": 4.8,
    "ratingCount": 342
  },

  "author": {
    "name": "Jane Smith"
  },

  "image": "https://example.com/images/cookies.jpg"
}
```

### Field Types

**Text Fields** (simple strings):
- `name`, `headline`, `description`, `recipeYield`, `prepTime`, `cookTime`, `totalTime`, `recipeCategory`, `recipeCuisine`, `keywords`
- Markdown formatting allowed: `**bold**`, `_italic_`, `[links](url)`

**List Fields** (markdown bullet lists):
- `recipeIngredient`: Newline-separated list with `-` or `*` bullets
- Each line is one ingredient
- Markdown formatting preserved: `**2 cups** flour`

**Structured Fields** (markdown with headings):
- `recipeInstructions`: Markdown with `## Heading` for sections
- Steps are numbered lists under each section
- Markdown formatting preserved throughout

**Object Fields** (nested JSON):
- `nutrition`: Object with nutrition facts
- `aggregateRating`: Object with rating data
- `author`: Object with author info
- `image`, `video`: URL strings or objects with metadata

**Optional Fields:**
- Any field can be omitted if not available
- Chef fills missing fields from cached values when Kassi sends partial data

---

## Data Format: Kassi → Chef

### Recipe Update Request

Kassi sends **full recipe object** with all displayed fields:

```json
{
  "name": "The Best Chocolate Chip Cookies",
  "description": "These are the **best** chocolate chip cookies you'll ever make! Updated with my secret ingredient.",
  "recipeYield": "24 cookies",
  "prepTime": "15 minutes",
  "cookTime": "12 minutes",
  "totalTime": "27 minutes",
  "recipeCategory": "Dessert",
  "recipeCuisine": "American",
  "keywords": "cookies, chocolate, baking, dessert, homemade",

  "recipeIngredient": "- **2 cups** [all-purpose flour](https://example.com/flour)\n- 1 tsp baking soda\n- 1/2 tsp salt\n- 1 cup butter (softened)\n- 3/4 cup granulated sugar\n- 3/4 cup brown sugar\n- **2 large eggs**\n- 2 tsp vanilla extract\n- 2 cups chocolate chips\n- 1 tsp espresso powder (secret ingredient!)",

  "recipeInstructions": "## Prepare Dough\n\n1. Preheat oven to **350°F** (175°C).\n2. Mix flour, baking soda, salt, and espresso powder in a bowl.\n3. In another bowl, cream together butter and both sugars until fluffy.\n4. Beat in eggs and vanilla.\n\n## Combine and Bake\n\n1. Gradually blend dry ingredients into butter mixture.\n2. Stir in chocolate chips.\n3. Drop rounded tablespoons of dough onto ungreased cookie sheets.\n4. Bake for **10-12 minutes** or until golden brown.\n5. Cool on baking sheet for 2 minutes before removing to a wire rack."
}
```

### What Chef Does

1. **Receives full recipe object**
2. **Parses markdown** → JSON-LD structure for each field:
   - Lists: `"- item1\n- item2"` → `["item1", "item2"]`
   - Instructions: Markdown with headings → `HowToSection[]` with `itemListElement: HowToStep[]`
3. **Wraps in ManagedField**:
   - Stores `value` (JSON-LD)
   - Stores `rendered` (markdown)
   - Computes `currentHash` from `value`
4. **Detects changes**:
   - Compares hashes with stored recipe
   - Identifies which fields user modified
5. **Updates user record**:
   - Stores only changed fields in DynamoDB
   - Adds history entry with `source: 'user'`
6. **Returns updated recipe**:
   - Same format as Chef → Kassi (rendered markdown)

---

## Markdown Format Details

### Ingredients

**Format:** Newline-separated bullet list

**Example:**
```markdown
- **2 cups** [all-purpose flour](https://example.com/flour)
- 1 tsp baking soda
- 1/2 tsp salt
- 1 cup butter (softened)
```

**Rules:**
- Each line starts with `-` or `*`
- Markdown formatting allowed: `**bold**`, `_italic_`, `[links](url)`
- Quantity and unit can be bolded for emphasis
- Ingredient name is plain text or link

### Instructions

**Format:** Markdown with `##` headings for sections, numbered lists for steps

**Example:**
```markdown
## Prepare Dough

1. Preheat oven to **350°F** (175°C).
2. Mix flour, baking soda, and salt in a bowl.
3. Cream together butter and sugars until fluffy.

## Bake

1. Drop dough onto cookie sheets.
2. Bake for **10-12 minutes** or until golden brown.
3. Cool on rack before serving.
```

**Rules:**
- Sections start with `##` (H2 heading)
- Steps are numbered lists (1., 2., 3.)
- Markdown formatting allowed in step text
- Blank line between sections

### Text Fields

**Format:** Simple string with inline markdown

**Example:**
```markdown
These are the **best** chocolate chip cookies you'll ever make! Perfect for [holiday baking](https://example.com/holidays).
```

**Rules:**
- `**bold**` for emphasis
- `_italic_` for emphasis
- `[text](url)` for links
- No headings or lists (use plain text)

---

## Field Mapping: JSON-LD ↔ Markdown

### Simple Text Fields

**Chef → Kassi:**
```typescript
// JSON-LD: "Chocolate Chip Cookies"
// Kassi: "Chocolate Chip Cookies"
```

### Ingredient Lists

**Chef → Kassi:**
```typescript
// JSON-LD: ["2 cups flour", "1 tsp salt"]
// Kassi: "- 2 cups flour\n- 1 tsp salt"
```

**Kassi → Chef:**
```typescript
// Kassi: "- **2 cups** flour\n- 1 tsp salt"
// JSON-LD: ["2 cups flour", "1 tsp salt"]
// Note: Markdown formatting stripped from JSON-LD value, preserved in rendered
```

### Instructions with Sections

**Chef → Kassi:**
```typescript
// JSON-LD:
[
  {
    "@type": "HowToSection",
    "name": "Prepare Dough",
    "itemListElement": [
      { "@type": "HowToStep", "text": "Mix flour and salt" },
      { "@type": "HowToStep", "text": "Cream butter and sugar" }
    ]
  }
]

// Kassi:
"## Prepare Dough\n\n1. Mix flour and salt\n2. Cream butter and sugar"
```

**Kassi → Chef:**
```typescript
// Kassi: "## Prepare\n\n1. Mix flour\n2. Add eggs"
// JSON-LD:
[
  {
    "@type": "HowToSection",
    "name": "Prepare",
    "itemListElement": [
      { "@type": "HowToStep", "text": "Mix flour" },
      { "@type": "HowToStep", "text": "Add eggs" }
    ]
  }
]
```

---

## Error Handling

### Missing Fields

**Scenario:** Kassi omits fields it doesn't display (e.g., `nutrition`, `author`)

**Chef behavior:**
- Fills missing fields from cached values
- Only updates fields present in Kassi's request
- Returns full recipe with all fields

### Invalid Markdown

**Scenario:** Kassi sends malformed markdown (e.g., no list bullets, no section headings)

**Chef behavior:**
- Attempts best-effort parsing
- Falls back to treating as plain text if structure unrecognizable
- Logs warning for debugging
- Returns error to Kassi if critical fields unparseable

### Empty Fields

**Scenario:** Kassi sends empty strings for optional fields

**Chef behavior:**
- Treats as deletion (user removed content)
- Updates field to empty value
- Preserves field in schema (doesn't delete entirely)

---

## API Endpoints

### GET /api/recipe/:urlHash

**Request:**
- Headers: `Authorization: Bearer <firebase-token>`
- URL params: `urlHash` (SHA-256 of recipe URL)

**Response:**
```json
{
  "recipe": {
    "name": "Recipe Name",
    "description": "Description text with **markdown**",
    "recipeIngredient": "- item1\n- item2",
    "recipeInstructions": "## Section\n\n1. Step 1",
    ...
  }
}
```

### PUT /api/recipe/:urlHash

**Request:**
- Headers: `Authorization: Bearer <firebase-token>`
- URL params: `urlHash`
- Body:
```json
{
  "recipe": {
    "name": "Updated Recipe Name",
    "description": "Updated description",
    "recipeIngredient": "- new item1\n- new item2",
    ...
  }
}
```

**Response:**
```json
{
  "recipe": {
    "name": "Updated Recipe Name",
    ...
  },
  "changedFields": ["name", "recipeIngredient"]
}
```

### POST /api/recipe/:urlHash/improve

**Request:**
- Headers: `Authorization: Bearer <firebase-token>`
- URL params: `urlHash`
- Body: (empty, no request body needed)

**Response:**
```json
{
  "recipe": {
    "name": "Recipe Name",
    "nutrition": {
      "calories": "210",
      "fatContent": "11g"
    },
    "storage": "Store in airtight container at room temperature for up to 1 week.",
    ...
  },
  "extractedFields": ["nutrition", "storage", "tips"]
}
```

---

## Summary

**Kassi's Perspective:**
- Receives simple recipe objects with markdown strings
- Displays markdown with rendering library
- Allows user to edit markdown freely
- Sends full updated recipe back to Chef

**Chef's Responsibility:**
- Converts internal ManagedField → simple format for Kassi
- Parses Kassi's markdown → JSON-LD → ManagedField
- Handles change detection, versioning, AI improvements internally
- Returns simple format to Kassi (hides complexity)

**Benefits:**
- Kassi remains simple (no knowledge of ManagedField internals)
- Chef handles all complexity (parsing, hashing, storage routing)
- Clean separation of concerns
- Easy to maintain and test
