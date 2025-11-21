# 🧑‍🍳 The Recipe Transformation Engine: Requirements & Architecture

This document defines the **requirements, constraints, and architectural expectations** for the Recipe Transformation Engine.

**Purpose:** Ingest public recipe data, convert it to user-editable format, enable AI-driven improvements, and maintain fidelity, consistency, and cross-user reusability.

**Key Goals:**
- Cache recipes to avoid redundant parsing
- Support per-user edits and improvements
- Reuse improvements across users when content matches
- Store field-level metadata for observability
- Provide stable identity tracking despite format changes

---

## 📊 Data Formats & Standards

The system works with **schema.org/Recipe** JSON-LD as the canonical structured format.

### Recipe Field Types

**Text Fields** (simple strings):
- `name`, `headline`, `keywords`
- `prepTime`, `cookTime`, `totalTime`
- `recipeYield`, `recipeCategory`, `recipeCuisine` (string arrays)

**Markdown Fields** (rendered for display/editing):
- `description` (string with formatting)
- `recipeIngredient` (string array, rendered as bulleted list)
- `recipeInstructions` (complex: `Array<string | HowToStep | HowToSection>`, rendered as sections with steps)

**Structured Objects** (no markdown conversion):
- `image`: `{ '@type': 'ImageObject', primaryContentUrl, additionalContentUrl }`
- `video`: `{ '@type': 'VideoObject', contentUrl, thumbnailUrl, ... }`
- `nutrition`: `{ '@type': 'NutritionInformation', calories, protein, ... }`
- `author`: `{ '@type': 'Person', name, url }`

### HTML Fidelity Preservation

Inline formatting from source HTML must be converted to Markdown:
- `<b>` / `<strong>` → `**bold**`
- `<i>` / `<em>` → `*italic*`
- `<a href="...">text</a>` → `[text](...)`

**Example Transformation:**
```html
<!-- Input HTML -->
<b>2 cups</b> <a href="...">all-purpose flour</a>

<!-- Output Markdown -->
**2 cups** [all-purpose flour](...)

<!-- Stored JSON-LD -->
["2 cups all-purpose flour"]
```

### Data Format Flow

**Prepper → Chef:**
- Prepper sends: JSON-LD structure + raw HTML fragments
- JSON-LD text fields may contain inline HTML: `<b>2 cups</b> flour`
- Raw HTML stored in S3 for LLM context

**Chef Processing:**
- Converts inline HTML → Markdown in JSON-LD text fields
- Stores both:
  - `value`: JSON-LD canonical structure (source of truth for hashing)
  - `rendered.value`: Markdown representation (for human display)
- Example: `["<b>2 cups</b> flour"]` → `value: ["2 cups flour"]`, `rendered.value: "- **2 cups** flour"`

**Chef → Kassi:**
- Chef sends: Simplified recipe object with only **rendered markdown strings**
- Kassi displays markdown in UI
- Format: `{ "name": "Recipe Name", "recipeIngredient": "- **2 cups** flour\n- 1 tsp salt" }`

**Kassi → Chef:**
- Kassi sends: Full recipe object with **edited rendered markdown strings**
- Chef parses: Markdown → JSON-LD structure
- Chef wraps: JSON-LD → ManagedField with hash
- Format: Same as Chef → Kassi (flat object with markdown strings)

**Storage in DynamoDB:**
- Both `value` (JSON-LD) and `rendered` (markdown) persisted in ManagedField
- Hash computed from `value` only (markdown can be regenerated)
- `rendered.version` tracks markdown converter version (for regeneration if logic changes)

---

## 🏗️ System Components

### **1. Prepper** (External Service)

**Responsibility:** Recipe ingestion and parsing

- Fetches public recipe webpages
- Extracts `schema.org/Recipe` JSON-LD data
- Extracts corresponding HTML fragments for each field
- Stores raw HTML in S3 for LLM context during improvements
- Returns structured data with fragment references

**Output:** JSON-LD recipe + HTML fragments

---

### **2. Chef** (API Backend)

**Responsibility:** Data orchestration, persistence, and AI improvements

- Receives requests from Kassi (authenticated via Firebase)
- Calls Prepper for initial recipe ingestion
- Stores recipes in DynamoDB (shared cache + per-user records)
- Converts JSON-LD ↔ Markdown for Kassi
- Manages improvement requests and reuse logic
- Tracks field-level metadata (hash, version, timestamps, LLM model)

**Key Operations:**
- `loadRecipe(userId, recipeUrl)` - First-time recipe setup for user
- `getRecipe(userId, recipeId)` - Retrieve existing user recipe
- `updateRecipe(userId, recipeId, recipe)` - Save user edits (full recipe object)
- `improveRecipe(userId, recipeId)` - AI enhancement (extracts additional fields)

---

### **3. Kassi** (React Native App)

**Responsibility:** User interface and editing

- Authenticates users via **Firebase** (Firebase UID used as user identifier)
- Displays recipes with markdown rendering for text-heavy fields
- Sends **full recipe object** with all fields (not partial updates):
  ```json
  {
    "name": "Fluffy Pancakes",
    "description": "Description with **markdown**",
    "recipeIngredient": "- 2 cups flour\n- 1 tsp salt",
    "recipeInstructions": "## Prepare\n1. Mix ingredients",
    "prepTime": "10 minutes",
    "cookTime": "15 minutes"
  }
  ```
- Fields Kassi doesn't display/edit are omitted from request (Chef fills from cached values)
- Triggers recipe improvement (user requests, Chef extracts additional fields via AI)
- Allows complete markdown editing freedom (reorder, merge, delete steps)

**Editing Behavior:**
- Users edit markdown directly in UI
- Kassi sends full recipe object with rendered markdown values to Chef
- Chef parses markdown back to JSON-LD structure and wraps in ManagedField
- Structural inference happens **server-side** (Chef responsibility)

**What Chef Sends to Kassi:**
- Simplified recipe object with only **rendered markdown strings** (not ManagedField wrappers)
- Kassi doesn't need to know about hashes, modifications, or internal metadata
- Format: flat object with field names → markdown strings (see solution/12-kassi-integration.md)

**What Kassi Sends to Chef:**
- Full recipe object with **rendered markdown strings** for all editable fields
- Chef converts markdown → JSON-LD → wraps in ManagedField → detects changes via hashing
- Format: same flat structure Chef sent (see solution/12-kassi-integration.md)

---

## ⚙️ Workflows

### **1. First Load: loadRecipe(userId, recipeUrl)**

**Trigger:** User adds a new recipe URL in Kassi

**Flow:**
1. Kassi calls `Chef.loadRecipe(firebaseUID, recipeUrl)`
2. Chef checks DynamoDB for existing user recipe
3. **If user has recipe:** Return it immediately
4. **If not:** Check shared cache for this URL
5. **If shared cache exists:**
   - Copy base recipe to user's record
   - Generate markdown from JSON-LD
   - Return to Kassi
6. **If no cache:**
   - Call Prepper to fetch and parse webpage
   - Store in S3 (raw HTML fragments)
   - Store in DynamoDB (shared cache)
   - Create user record
   - Generate markdown
   - Return to Kassi

**Result:** User has personalized recipe record, markdown ready for display

**Important:** This happens **once per user per recipe**. Subsequent opens use `getRecipe()`.

---

### **2. Retrieve Existing: getRecipe(userId, recipeId)**

**Trigger:** User opens a recipe they've already loaded

**Flow:**
1. Kassi calls `Chef.getRecipe(firebaseUID, recipeId)`
2. Chef reads from DynamoDB `user#<firebaseUID>` partition
3. Returns stored recipe with markdown already generated
4. **No conversion needed** - markdown is persisted

**Result:** Fast retrieval, no processing overhead

---

### **3. User Edit: updateRecipe(userId, recipeId, recipe)**

**Trigger:** User edits recipe in Kassi and saves

**Flow:**
1. Kassi sends full recipe object with all fields (rendered markdown):
   ```json
   {
     "name": "Fluffy Pancakes",
     "description": "Best pancakes ever",
     "recipeIngredient": "- 3 cups flour\n- 2 tsp salt",
     "recipeInstructions": "## Prepare\n1. Mix ingredients",
     "prepTime": "10 minutes"
   }
   ```
2. Chef receives full recipe with rendered markdown values
3. Chef parses markdown → JSON-LD for each field:
   - List items → string array
   - Sections/steps → HowToSection/HowToStep structures
4. Chef wraps each field in ManagedField and computes hash from JSON-LD
5. Chef compares hashes with stored recipe to detect changed fields
6. Chef updates user record for changed fields only:
   - Store JSON-LD value + rendered markdown
   - Update hash
   - Add history entry with `source: 'user'`
   - Update timestamps

**Result:** User's edits are persisted in user record, isolated from shared cache

---

### **4. Improvement: improveRecipe(userId, recipeId)**

**Trigger:** User clicks "Improve Recipe" button in Kassi

**Flow:**

#### A. Check for Reusable Improvements

1. Get user's current recipe (merge user + shared baseline)
2. For each field that can be improved:
   - Compute hash of current value (JSON-LD)
   - Check shared cache improvements map:
     - If field has `baseHash` in improvements → return cached improvement (skip LLM)
     - This works when user hasn't edited the field

#### B. Generate New Improvements via LLM

3. If no cached improvements found:
   - Fetch raw HTML from S3
   - Extract URLs to placeholders (minimize LLM tokens)
   - Call LLM with HTML context (e.g., `recipe-extras` prompt)
   - LLM extracts new fields: nutrition, storage tips, allergens, etc.
   - Restore URLs from placeholders
   - Parse LLM response → JSON-LD structure
   - Generate rendered markdown from JSON-LD

#### C. Store Improvements

4. For each improved/extracted field:
   - **If user hasn't edited field** (no user history entries):
     - Store improvement in shared cache `improvements` map with `baseHash` as key
     - Other users with same `baseHash` can reuse this improvement
     - Update user record with improved field
   - **If user has edited field** (has user history entries):
     - Store improvement only in user's record
     - Does NOT propagate to shared cache (user-specific improvement)
   - Add history entry with `source: 'llm'`, include `llmModel` and `promptVersion`
   - Compute new hash from JSON-LD

#### D. Return Result

5. Return full improved recipe to Kassi (rendered markdown values)
6. Kassi displays updated content

**Result:** Improvements are reused across users when possible (same baseHash), isolated when user has customized

---

### **5. Cache Hit Scenario**

**Trigger:** User 2 loads same recipe URL as User 1

**Flow:**
1. User 2 calls `loadRecipe(user2ID, sameRecipeUrl)`
2. Chef finds shared cache (created by User 1's load)
3. Chef returns shared baseline recipe (no user-specific record created yet)
4. User 2 sees base recipe with rendered markdown
5. User 2 gets unimproved base version initially

**Important:** Users start with base version. When they call `improveRecipe()`, Chef checks shared cache for existing improvements.

---

### **6. Improvement Reuse Scenario**

**Trigger:** User 2 improves recipe that User 1 already improved

**Flow:**
1. User 1 improved recipe, extracted `nutrition` field (base hash: `abc123`)
2. Improvement stored in shared cache improvements map: `{ "abc123": improvedField }`
3. User 2 loads same recipe (gets base with field hash `abc123`)
4. User 2 calls `improveRecipe()`
5. Chef checks: User 2's `nutrition` field hash == `abc123`
6. Chef finds cached improvement in shared cache improvements map
7. Chef returns cached improvement (no LLM call needed for this field)
8. User 2's record updated with improved field

**Result:** LLM call avoided for fields already improved by other users, instant improvement

---

## 🎯 Improvement Rules

### Reuse Conditions

Improvements are **reusable across users** when:
1. Field content hash matches base recipe hash
2. User has not edited the field
3. Improvement exists in shared cache

Improvements are **user-specific** when:
1. User edited field before improving
2. Field hash differs from base hash
3. Stored only in user's record

### Improvement Behavior

**If field exists:**
- LLM **rewrites** field for clarity/enhancement
- Example: "2 cups flour" → "2 cups all-purpose flour, sifted"

**If field doesn't exist:**
- LLM **adds new field**
- Example: Infer `allergens: ["gluten", "dairy"]` from ingredients

### LLM Input Format

**For linguistic tasks** (rewrite, clarify):
- Send markdown to LLM
- Preserves formatting, easier for LLM to read

**For structural tasks** (infer, extract, classify):
- Send JSON-LD to LLM
- Structured data easier for extraction

**Never send:**
- Raw AST (too verbose)
- Raw HTML (too noisy)

---

## 🔑 Key Requirements

### 1. User Authentication
- Firebase Auth in Kassi
- Firebase UID as user identifier
- DynamoDB partition key: `user#<firebaseUID>`

### 2. Field-Level Metadata

Every field wrapped in `ManagedField<T>` must track:

**Core Data:**
- **value** (T): JSON-LD canonical structure (source of truth for hashing, persistence, AI)
- **rendered**: Object containing markdown representation for display:
  - `type`: Format type (e.g., "markdown", "html", "text")
  - `value`: Rendered content string
  - `version`: Renderer version (tracks markdown converter version)
  - `ref` (optional): S3 reference if stored externally

**Identity & Lineage:**
- **currentHash**: SHA-256 hash of canonical JSON (`value`), used for change detection
- **baseHash**: Hash of original unimproved version (enables improvement reuse)

**History:**
- **history**: Array of edit history entries (can be pruned to last N entries):
  ```typescript
  {
    timestamp: string;           // ISO 8601
    hash: string;                // Content hash at this point
    source: "prepper" | "llm" | "user";
    actor?: string;              // firebaseUID or 'system'
    llmModel?: string;           // e.g., "claude-3-5-sonnet" (if source='llm')
    promptVersion?: string;      // e.g., "v1.2.0" (if source='llm')
    summary: string;             // "Initial ingestion" | "User edited" | "AI extracted field"
  }
  ```

**Requirements:**
- System must be able to determine if field was user-edited (for cache update routing)
- System must be able to determine if field was AI-improved (for observability)
- System must track last modification timestamp and actor
- Full audit trail must be available for debugging and compliance

### 3. Uniform Field Structure

**ALL fields** must be wrapped uniformly (consistency requirement):
- Simple text fields (name, prepTime)
- Markdown fields (ingredients, instructions)
- Object fields (image, video, nutrition)

Every field has same metadata structure, regardless of type.

### 5. Markdown Parsing (Server-Side)

When user sends markdown, Chef must parse it back to JSON-LD:

**Ingredients:**
```markdown
- 2 cups flour
- 1 tsp salt
```
→ `["2 cups flour", "1 tsp salt"]`

**Instructions:**
```markdown
## Make the batter

1. Mix flour and salt
2. Add eggs

## Bake

1. Preheat oven
```
→
```json
[
  {
    "@type": "HowToSection",
    "name": "Make the batter",
    "itemListElement": [
      { "@type": "HowToStep", "text": "Mix flour and salt" },
      { "@type": "HowToStep", "text": "Add eggs" }
    ]
  },
  {
    "@type": "HowToSection",
    "name": "Bake",
    "itemListElement": [
      { "@type": "HowToStep", "text": "Preheat oven" }
    ]
  }
]
```

**Tools needed:** `unified`, `remark-parse`, `mdast-util-to-string`

### 6. Hash Stability

**Critical:** Hash the **JSON-LD**, not the markdown.

**Why:** Markdown rendering logic may change (bug fixes, improvements). If hashes are based on markdown, they break when renderer updates.

**Solution:** Always compute hash from canonicalized JSON-LD:
```typescript
import canonicalize from 'canonical-json';

const hash = sha256(canonicalize(field.value)); // field.value is JSON-LD
```

This keeps hashes stable even if markdown converter changes.

### 7. Structural Edits

Users can:
- Reorder steps
- Merge multiple steps into one
- Split one step into many
- Delete sections entirely
- Add new sections

When this happens:
- New hash computed
- Marked as user-edited
- No longer matches base
- Improvements become user-specific

---

## ⚠️ Challenges & Constraints

### 1. Content Identity

**Challenge:** When is content "the same"?

**Scenarios:**
- User edits "2 cups flour" → "2 cups all-purpose flour"
- Hash changes, but semantically similar
- Should improvement still apply?

**Constraint:** Use exact hash matching. Semantic similarity is future enhancement.

---

### 2. Hash Stability

**Challenge:** Markdown converter changes break hashes

**Solution:** Hash JSON-LD, not markdown. Markdown can be regenerated.

**Implication:** Store both JSON-LD (for hashing) and markdown (for display).

---

### 3. Format Conversion Overhead

**Challenge:** Converting JSON-LD ↔ Markdown on every request is expensive

**Solution:**
- Generate markdown once on `loadRecipe`
- Persist markdown in DynamoDB
- Only regenerate when:
  - Converter version changes
  - JSON-LD updated by LLM
  - User sends markdown edit (parse back to JSON-LD)

---

### 4. Improvement Query Pattern

**Challenge:** How does Chef find "has anyone improved this content"?

**Solution:** Store improvements in shared cache record:
```
DynamoDB:
  PK: "recipe#<urlHash>"
  SK: "base"
  fields: {
    ingredients: {
      base: { jsonLd, markdown, hash: "abc" },
      improved: { jsonLd, markdown, hash: "def", llmModel, ... }
    }
  }
```

**Query:** O(1) lookup by field name, no GSI needed.

---

### 5. Storage Growth

**Challenge:** Full history per field grows unbounded

**Constraint:**
- DynamoDB item size limit: 400KB
- History must be managed (truncate, archive, or external storage)

**Recommendation:** Keep last N entries in DynamoDB, archive rest to S3.

---

### 6. Observability

**Requirement:** DynamoDB should store exactly what users see.

**Rationale:** Debugging requires seeing actual data, not reconstructed views.

**Solution:** Store markdown alongside JSON-LD. Redundant but essential for debugging.

---

### 7. Structural Inference

**Challenge:** User edits markdown freely, Chef must infer structure

**Example:**
```markdown
Ingredients:
- 2 cups flour
- salt
```

**Inference needed:**
- "Ingredients:" is heading (not ingredient)
- Lines are list items
- "salt" has no quantity

**Constraint:** Parser must be robust to malformed markdown.

---

## 🔍 Open Design Questions

These are **requirements**, not solutions. The solution must address:

1. **DynamoDB Schema:**
   - Single table or multiple tables?
   - How to partition (user vs recipe)?
   - How to query for improvements efficiently?

2. **Field Envelope Structure:**
   - What exact properties are needed?
   - How to handle different field types uniformly?
   - How much metadata is too much?

3. **Markdown Storage:**
   - Always persist or compute on-demand?
   - Cache in Redis vs DynamoDB?
   - Versioning strategy?

4. **Improvement Storage:**
   - Separate table or nested in recipe?
   - How to handle multiple improvement versions?
   - When to garbage collect old improvements?

5. **Race Conditions:**
   - Two users improve simultaneously
   - Both have same base hash
   - How to handle concurrent writes?

6. **Migration Path:**
   - Existing `BaseRecipe` table has different schema
   - How to migrate without downtime?
   - Backward compatibility needed?

---

## ✅ Success Criteria

The solution must:

1. ✅ Support Firebase-authenticated users
2. ✅ Store recipes with field-level metadata
3. ✅ Enable improvement reuse across users
4. ✅ Maintain stable hashes across format changes
5. ✅ Parse markdown back to JSON-LD server-side
6. ✅ Track full edit history per field
7. ✅ Handle arbitrary user edits gracefully
8. ✅ Cache recipes to avoid redundant Prepper calls
9. ✅ Isolate user edits from shared improvements
10. ✅ Provide O(1) improvement lookup (no expensive queries)

---

## 📝 Out of Scope (for now)

- Semantic similarity matching (only exact hash matching)
- Multi-device sync (handled by DynamoDB)
- Offline mode (Kassi handles caching)
- Recipe versioning (history provides basic versioning)
- Collaborative editing (single-user edit model)
- Recipe forking/branching (linear history only)

---

**This document defines WHAT the system must do. The solution defines HOW to implement it.**

---

## 🔐 Authentication Architecture

### API Gateway JWT Authorizer (HTTP API)

**Setup:**
- Use API Gateway HTTP API (not REST API)
- Configure JWT authorizer directly in API Gateway
- Issuer URL: `https://securetoken.google.com/<firebase-project-id>`
- Audience: Firebase project ID or app's client ID

**How it works:**
1. Client (Kassi) sends request with `Authorization: Bearer <firebase-token>` header
2. API Gateway validates JWT signature against Firebase public keys
3. API Gateway checks token claims (issuer, audience, expiration)
4. If valid, API Gateway forwards request to Lambda with decoded claims in event context
5. If invalid, API Gateway returns 401 before Lambda is invoked

**Lambda receives pre-verified claims:**
```typescript
// event.requestContext.authorizer.jwt.claims contains:
{
  sub: "firebase-user-id",  // This is firebaseUID
  email: "user@example.com",
  iss: "https://securetoken.google.com/<project-id>",
  aud: "<project-id>",
  exp: 1234567890,
  iat: 1234567890,
  // ... other Firebase claims
}
```

**Implementation in Lambda:**
```typescript
export const handler = async (event: APIGatewayProxyEventV2) => {
  // Extract firebaseUID from pre-verified claims
  const firebaseUID = event.requestContext.authorizer?.jwt?.claims?.sub as string;

  if (!firebaseUID) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  // Use firebaseUID for all operations
  // ...
};
```

**Key Benefits:**
- **Zero Lambda code for JWT verification** - API Gateway handles it
- **No Firebase Admin SDK needed for auth** - only for other Firebase operations (if any)
- **Claims available in `event.requestContext.authorizer.jwt.claims`**
- **`sub` claim = firebaseUID** (Firebase user ID)
- **401 returned automatically** for invalid/expired tokens before Lambda invocation

**Reference:** [AWS API Gateway HTTP API JWT Authorizers](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-jwt-authorizer.html)
