# 8. Markdown Conversion

**Prerequisites:** [Services](./04-services.md), [LLM Integration](./07-llm-integration.md)
**Next:** [Migration](./09-migration.md)

---

## Overview

**Goal:** Create isolated, testable markdown conversion service for ALL recipe fields.

**Key Principle:** Service is decoupled from business logic, easy to test and debug.

**Responsibility:** Bidirectional conversion between JSON-LD and markdown for complete recipes.

**Flow:**
- Prepper sends JSON-LD with HTML in text fields
- Chef converts HTML→Markdown immediately
- Stores markdown in `rendered` field (for Kassi display)
- Parses markdown back to JSON-LD when user edits (Kassi→Chef)

---

## Existing Infrastructure

### RecipeConverterService

**Current capability:**

```typescript
class RecipeConverterService {
  toRecipeExtractionInput(page: EnhancedRecipePage): RecipeExtractionInput {
    // Converts enhanced page to LLM-friendly format
    return {
      html: page.cleanedHtml,
      name: page.metadata?.name,
      description: page.metadata?.description,
      plugins: {
        minify: page.minificationMap,
        images: page.images,
        videos: page.videos,
        'ld-json': page.ldJson,
      },
    };
  }
}
```

### HtmlReplacementService

**Current capability:**

```typescript
class HtmlReplacementService {
  // Obfuscate HTML tags
  obfuscate({
    rawHtml,
    replaceTags  // e.g., ['a', 'img']
  }): HtmlReplacementResult {
    // Replaces <a> and <img> with simplified versions
    // Returns { transformedHtml, replacements }
  }

  // Restore original HTML
  restore({ obfuscatedHtml }): string {
    // Restores original tags from replacements map
  }
}
```

---

## MarkdownConversionService Design

### Service Responsibility

**Location:** `src/services/markdown-conversion-service.ts`

**Purpose:** Isolated markdown conversion for ALL recipe fields.

**Design Principles:**
- **Isolated:** No business logic dependencies (just data transformation)
- **Testable:** Pure functions with comprehensive tests
- **Debuggable:** Clear errors with field context
- **Versioned:** Tracks `markdownVersion: "1.0.0"` for future migrations

### Conversion Flows

**Flow 1: First Load (Prepper → Chef)**
- Prepper sends JSON-LD with inline HTML: `"<b>2 cups</b> flour"`
- Convert HTML tags to markdown: `"**2 cups** flour"`
- Store clean markdown in `value`
- Generate `rendered.value` for display

**Flow 2: Display (Chef → Kassi)**
- Take `ManagedRecipe` with JSON-LD values
- Generate flat `KassiRecipe` with markdown strings
- Kassi displays markdown

**Flow 3: Edit (Kassi → Chef)**
- User edits markdown strings in Kassi
- Parse markdown back to JSON-LD structure
- Wrap in `ManagedField`, compute hashes, detect changes

### Service Interface

```typescript
class MarkdownConversionService {
  readonly version = '1.0.0';

  // HTML → Markdown conversion (inline tags only)
  convertHtmlToMarkdown(text: string): string

  // Chef → Kassi (generate display format)
  toKassiFormat(recipe: ManagedRecipe): KassiRecipe
  fieldToMarkdown(fieldName: FieldName, value: any): string

  // Kassi → Chef (parse user edits)
  fromKassiFormat(kassi: KassiRecipe): RecipeJsonLd
  markdownToField(fieldName: FieldName, markdown: string): any

  // LLM optimization (separate concern)
  extractUrlsForLLM(html: string): { transformedHtml, urlMap }
  restoreUrlsFromLLM(markdown: string, urlMap): string
}
```

---

## HTML to Markdown Conversion

### Inline Tag Conversion

**Supported tags:** `<b>`, `<strong>`, `<i>`, `<em>`, `<a>`

**Conversion rules:**
- `<b>text</b>` → `**text**`
- `<strong>text</strong>` → `**text**`
- `<i>text</i>` → `_text_`
- `<em>text</em>` → `_text_`
- `<a href="url">text</a>` → `[text](url)`

**Image handling:** `<img>` tags preserved as-is (handled by HtmlReplacementService during LLM calls)

**Example:**
```
Input:  "<b>2 cups</b> <a href='...'>all-purpose flour</a>"
Output: "**2 cups** [all-purpose flour](...)"
```

---

## Field Conversion Rules

### 1. Text Fields (name, description, headline)

**JSON-LD → Markdown:** Convert HTML tags, return as-is

**Markdown → JSON-LD:** Return as-is (preserve markdown)

### 2. List Fields (recipeIngredient, keywords)

**JSON-LD → Markdown:**
- Join array with newlines
- Prefix each line with `- `
- Result: `"- item1\n- item2\n- item3"`

**Markdown → JSON-LD:**
- Split on newlines
- Remove `- ` or `* ` prefix
- Trim whitespace
- Filter empty lines
- Result: `["item1", "item2", "item3"]`

### 3. Instructions (recipeInstructions)

**Complex field:** Handled by dedicated `MarkdownInstructionParser` sub-service

**See detailed rules in "Instruction Parsing" section below**

### 4. Time Fields (prepTime, cookTime, totalTime)

**JSON-LD → Markdown:**
- Parse ISO 8601: `"PT15M"` → `"15 minutes"`
- Parse ISO 8601: `"PT1H30M"` → `"1 hour 30 minutes"`

**Markdown → JSON-LD:**
- Parse readable: `"15 min"` → `"PT15M"`
- Parse readable: `"1h 30m"` → `"PT1H30M"`
- Flexible parsing: accept "min/mins/minute/minutes", "h/hr/hour/hours"

### 5. Object Fields (nutrition, author, image, aggregateRating)

**No conversion:** Pass through as-is (structured JSON objects)

---

## Instruction Parsing

### MarkdownInstructionParser (Sub-Service)

**Location:** `src/services/markdown-instruction-parser.ts`

**Purpose:** Handle complex instruction parsing (isolated from main service)

**Interface:**
```typescript
class MarkdownInstructionParser {
  parse(markdown: string): HowToSection[] | HowToStep[] | string
}

class InstructionToMarkdownConverter {
  convert(instructions: any): string
}
```

### Parsing Rules

1. **`## Heading`** defines sections (HowToSection)
2. **Blank lines** separate steps (paragraphs become HowToStep.text)
3. **`###` or lower** is part of step text (not a section marker)
4. **Lists** (bullets/numbered) are part of step text
5. **Structure detection:**
   - Has `##` → HowToSection[]
   - Multiple paragraphs, no `##` → HowToStep[]
   - Single paragraph → string
6. **Empty sections allowed** (itemListElement: [])

### Token Optimization (Current Implementation)

**Current Implementation:** `HtmlReplacementService` (already exists in codebase)

**Location:** `src/services/html-replacement-service.ts`

**Purpose:** Minimize LLM tokens by simplifying HTML `<a>` and `<img>` tags before sending to LLM.

**How it works:**
- Replaces complex HTML tags with simplified versions
- `<a href="...long-url..." class="...">text</a>` → `<a href="a-1">text</a>`
- `<img src="...long-url..." alt="..." class="...">` → `<img src="img-1">`
- Stores mapping for restoration after LLM processing

**Usage:** Already integrated in `RecipeExtrasService.extractExtras()` at line 34.

**Future Enhancement:** Additional URL extraction method that replaces bare URLs (not inside tags) with placeholders:
```typescript
// Future: Add to MarkdownConversionService if needed
extractUrlsForLLM(html: string): { transformedHtml: string; urlMap: Record<string, string> } {
  // Extract standalone URLs: "https://example.com" → "[URL_1]"
  // Different from HtmlReplacementService which handles <a> and <img> tags
}
```

#### A. HTML→Markdown (On First Load)

Convert inline HTML in JSON-LD text fields to Markdown:

**Image Handling:** `<img>` tags are preserved in markdown. They're handled separately by `HtmlReplacementService` during LLM calls (obfuscated/restored to minimize tokens).

```typescript
class MarkdownConversionService {
  private readonly version = '1.0.0';

  // Convert inline HTML to Markdown (bold, italic, links)
  // IMPORTANT: Preserve <img> tags (handled separately by HtmlReplacementService)
  convertHtmlToMarkdown(value: string): string {
    if (!this.containsHtml(value)) return value;

    return value
      .replace(/<b>(.*?)<\/b>/gi, '**$1**')
      .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<i>(.*?)<\/i>/gi, '_$1_')
      .replace(/<em>(.*?)<\/em>/gi, '_$1_')
      .replace(/<a\s+href="([^"]+)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
  }

  // Convert entire recipe on first load
  convertRecipeHtmlToMarkdown(recipe: RecipeJsonLd): RecipeJsonLd {
    // Convert all text fields recursively
    // Handle: name, description, recipeIngredient items,
    // HowToStep.text, HowToSection.name, etc.
  }
}
```

#### B. JSON-LD→Flat Markdown (Chef → Kassi)

Convert JSON-LD structure to flat markdown strings for Kassi editing:

```typescript
interface KassiRecipe {
  // All fields as plain markdown strings
  name?: string;
  description?: string;
  recipeIngredient?: string;       // markdown list
  recipeInstructions?: string;     // markdown with headings
  recipeYield?: string;
  // ... all other fields as strings
}

class MarkdownConversionService {
  toKassiFormat(recipe: ManagedRecipe): KassiRecipe {
    return {
      name: recipe.name?.value,
      description: recipe.description?.value,
      recipeIngredient: this.ingredientsToMarkdown(recipe.recipeIngredient?.value),
      recipeInstructions: this.instructionsToMarkdown(recipe.recipeInstructions?.value),
      // ... all fields
    };
  }

  private ingredientsToMarkdown(ingredients: string[]): string {
    // string[] → markdown list
    return ingredients.map(ing => `- ${ing}`).join('\n');
  }

  private instructionsToMarkdown(instructions: Array<string | HowToStep | HowToSection>): string {
    let markdown = '';

    for (const item of instructions) {
      if (typeof item === 'string') {
        markdown += item + '\n\n';
      } else if (item['@type'] === 'HowToStep') {
        markdown += item.text + '\n\n';
      } else if (item['@type'] === 'HowToSection') {
        // Section with heading
        markdown += `# ${item.name}\n\n`;
        const steps = item.itemListElement || item.steps || [];
        for (const step of steps) {
          markdown += step.text + '\n\n';
        }
      }
    }

    return markdown.trim();
  }
}
```

**Example Output:**
```markdown
# Make the batter

Combine **together the flour**, sugar (or sweetener), [baking powder](https://whatisbackingpowder) (...)

# Bake

Preheat oven to 350°F. Pour batter into pan.
```

#### C. Flat Markdown→JSON-LD (Kassi → Chef)

Parse flat markdown strings back to JSON-LD structure.

**Create dedicated parsing service:** `MarkdownInstructionParser` (isolated, testable)

**Parsing Rules:**
1. **`## Heading`** defines sections (HowToSection)
2. **Blank lines** separate steps (paragraphs)
3. **`###` or lower** is part of step text (not a section)
4. **Lists (bullets/numbered)** are part of step text
5. **If no `##` headings:**
   - Multiple paragraphs → HowToStep[]
   - Single paragraph → string
6. **Empty section** (no steps) → HowToSection with empty itemListElement

**Service Structure:**
```typescript
class MarkdownInstructionParser {
  /**
   * Parse markdown instructions to schema.org format
   *
   * @returns HowToSection[], HowToStep[], or string
   */
  parse(markdown: string): HowToSection[] | HowToStep[] | string {
    // Implementation: See detailed parsing logic below
  }
}

class InstructionToMarkdownConverter {
  /**
   * Reverse: Convert schema.org → markdown
   */
  convert(instructions: HowToSection[] | HowToStep[] | string): string {
    // Implementation: Reverse of parse()
  }
}
```

**Detailed Parsing Logic:**
```typescript
// Detect structure
const hasSections = /^## .+$/m.test(markdown);  // Has ## headings?
const paragraphs = markdown.split(/\n\s*\n/);   // Split on blank lines

if (paragraphs.length === 1 && !hasSections) {
  return paragraphs[0];  // Single paragraph → string
}

if (hasSections) {
  return parseSections(markdown);  // Has ## → HowToSection[]
}

return parseSteps(paragraphs);  // Multiple paragraphs → HowToStep[]
```

**Example: With Sections**
```markdown
## Prepare Dough

Mix flour and salt in bowl.

Cream together butter and sugar.

## Bake

Preheat oven to 350°F.

Bake for 12 minutes.
```
→ Returns: `HowToSection[]` with 2 sections, each with multiple steps

**Example: No Sections**
```markdown
Mix all ingredients together.

Pour into pan and bake.
```
→ Returns: `HowToStep[]` with 2 steps

**Example: Single Step**
```markdown
Mix all ingredients and bake at 350°F for 20 minutes.
```
→ Returns: `string`

**Example: Lists and ### in Step**
```markdown
## Prepare

Gather tools:
- Mixing bowl
- Whisk

### Note: Use large bowl for best results

Mix ingredients thoroughly.
```
→ Returns: HowToSection with 2 steps:
  1. "Gather tools:\n- Mixing bowl\n- Whisk"
  2. "### Note: Use large bowl for best results\n\nMix ingredients thoroughly."

**Integration:**
```typescript
class MarkdownConversionService {
  private instructionParser = new MarkdownInstructionParser();

  fromKassiFormat(kassiRecipe: KassiRecipe): RecipeJsonLd {
    return {
      '@type': 'Recipe',
      name: kassiRecipe.name,
      recipeIngredient: this.markdownToIngredients(kassiRecipe.recipeIngredient),
      recipeInstructions: this.instructionParser.parse(kassiRecipe.recipeInstructions),
      // ... all fields
    };
  }

  private markdownToIngredients(markdown: string): string[] {
    return markdown
      .split('\n')
      .map(line => line.replace(/^[-*]\s+/, '').trim())
      .filter(line => line.length > 0);
  }
}
```

**Testing:** Comprehensive test suite with all edge cases (see implementation phase)

### 2. ManagedRecipe → RecipeExtractionInput

**Purpose:** Convert managed recipe back to LLM input format for re-processing.

**Direction:** Add method to RecipeConverterService:

```typescript
toRecipeExtractionInput(recipe: ManagedRecipe): RecipeExtractionInput {
  return {
    html: recipe.originalSource?.value || '',
    name: recipe.name?.value,
    description: recipe.description?.value,
    plugins: {
      minify: recipe.metadata?.minificationMap,
      images: recipe.metadata?.images,
      videos: recipe.metadata?.videos,
      'ld-json': recipe.metadata?.ldJson,
    },
  };
}
```

### 2. RecipeExtractionInput → ManagedRecipe

**Purpose:** Wrap LLM output in `ManagedField<T>` structure.

**Direction:** Add method to RecipeConverterService:

```typescript
toManagedRecipe(
  input: RecipeExtractionInput,
  extractedData: any  // LLM output
): ManagedRecipe {
  // Wrap each field in ManagedField
  return {
    name: wrapField(extractedData.name, 'ai', 0.9),
    description: wrapField(extractedData.description, 'ai', 0.85),
    ingredients: wrapField(extractedData.ingredients, 'ai', 0.8),
    directions: wrapField(extractedData.directions, 'ai', 0.8),
    // ... all fields
    sourceUrl: input.url,
    originalSource: wrapField(input.html, 'scraped', 1.0),
    metadata: {
      minificationMap: input.plugins.minify,
      images: input.plugins.images,
      // ...
    },
  };
}

function wrapField<T>(value: T, source: FieldSource, confidence: number): ManagedField<T> {
  return {
    value,
    source,
    confidence,
    contentHash: hashContent(value),
    lastModified: new Date().toISOString(),
  };
}
```

---

## Markdown Generation

### ManagedRecipe → Markdown

**Purpose:** Convert recipe to human-readable/editable Markdown format.

**Direction:** Add method to RecipeConverterService:

```typescript
toMarkdown(recipe: ManagedRecipe): string {
  // Extract values from managed fields
  const name = recipe.name?.value || 'Untitled Recipe';
  const description = recipe.description?.value || '';
  const ingredients = recipe.ingredients?.value || [];
  const directions = recipe.directions?.value || [];

  // Build Markdown document
  return `# ${name}

${description}

---

**Yield:** ${recipe.servings?.value || 'N/A'} | **Time:** ${recipe.totalTime?.value || 'N/A'}

---

## Ingredients

${formatIngredients(ingredients)}

---

## Instructions

${formatDirections(directions)}

---

${formatNutrition(recipe.nutrition?.value)}
`.trim();
}
```

### Formatting Helpers

**Ingredients:**

```typescript
function formatIngredients(ingredients: IngredientSection[]): string {
  return ingredients
    .map(section => {
      let md = section.section ? `### ${section.section}\n\n` : '';
      md += section.ingredients
        .map(ing => {
          const qty = ing.quantity ? `${ing.quantity} ` : '';
          const unit = ing.unit ? `${ing.unit} ` : '';
          return `- ${qty}${unit}${ing.name}`;
        })
        .join('\n');
      return md;
    })
    .join('\n\n');
}
```

**Directions:**

```typescript
function formatDirections(directions: DirectionSection[]): string {
  let stepNumber = 1;
  return directions
    .map(section => {
      let md = section.section ? `### ${section.section}\n\n` : '';
      md += section.steps
        .map(step => `${stepNumber++}. ${step}`)
        .join('\n');
      return md;
    })
    .join('\n\n');
}
```

**Nutrition:**

```typescript
function formatNutrition(nutrition?: NutritionInfo): string {
  if (!nutrition) return '';

  return `## Nutrition

${Object.entries(nutrition)
  .map(([key, value]) => `**${key}:** ${value}`)
  .join(' | ')}`;
}
```

### Markdown → ManagedRecipe

**Purpose:** Parse edited Markdown back into `ManagedRecipe`.

**Direction:** Use `unified` + `remark-parse` for AST parsing:

```typescript
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { visit } from 'unist-util-visit';

fromMarkdown(markdown: string, existing: ManagedRecipe): ManagedRecipe {
  const tree = unified().use(remarkParse).parse(markdown);

  const updates: Partial<ManagedRecipe> = {};

  // Traverse AST to extract sections
  visit(tree, (node) => {
    if (node.type === 'heading' && node.depth === 1) {
      // H1 = recipe name
      updates.name = wrapField(toString(node), 'user', 1.0);
    }

    if (node.type === 'heading' && node.depth === 2) {
      const heading = toString(node);
      if (heading === 'Ingredients') {
        // Parse ingredient list from next nodes
        updates.ingredients = wrapField(parseIngredients(node), 'user', 1.0);
      }
      if (heading === 'Instructions') {
        // Parse directions from next nodes
        updates.directions = wrapField(parseDirections(node), 'user', 1.0);
      }
    }
  });

  // Merge updates with existing recipe
  return { ...existing, ...updates };
}
```

---

## HTML to Markdown Conversion

### Inline Formatting Preservation

**Direction:** Convert HTML inline formatting to Markdown equivalents:

```typescript
function htmlToMarkdown(html: string): string {
  return html
    // Bold
    .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b>(.*?)<\/b>/gi, '**$1**')

    // Italic
    .replace(/<em>(.*?)<\/em>/gi, '_$1_')
    .replace(/<i>(.*?)<\/i>/gi, '_$1_')

    // Links
    .replace(/<a\s+href="([^"]+)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')

    // Remove other tags (keep text)
    .replace(/<[^>]+>/g, '')

    // Clean whitespace
    .trim();
}
```

### Markdown to HTML Conversion

**Direction:** For displaying in UI, convert back to HTML:

```typescript
function markdownToHtml(markdown: string): string {
  return markdown
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')

    // Italic
    .replace(/_([^_]+)_/g, '<em>$1</em>')

    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')

    // Paragraphs
    .split('\n\n')
    .map(p => `<p>${p}</p>`)
    .join('\n');
}
```

---

## Integration with HtmlReplacementService

**Use case:** Preserve complex HTML (links, images) during LLM processing.

**Direction:** Before sending to LLM, obfuscate:

```typescript
const htmlService = new HtmlReplacementService();

// Before LLM
const { transformedHtml, replacements } = htmlService.obfuscate({
  rawHtml: recipe.description?.value || '',
  replaceTags: ['a', 'img'],
});

// Send transformedHtml to LLM

// After LLM
const improvedText = llmResponse.text;
const restored = htmlService.restore({
  obfuscatedHtml: improvedText,
});
```

---

## Summary

**RecipeConverterService extensions:**
1. `toRecipeExtractionInput(ManagedRecipe)` - For LLM re-processing
2. `toManagedRecipe(input, extractedData)` - Wrap LLM output in ManagedField
3. `toMarkdown(ManagedRecipe)` - Generate human-readable Markdown
4. `fromMarkdown(markdown, existing)` - Parse edited Markdown back

**Key utilities:**
- `htmlToMarkdown()` - Convert HTML inline formatting
- `markdownToHtml()` - Convert Markdown for display
- `HtmlReplacementService` - Preserve complex HTML during LLM processing
- AST parsing with `unified` + `remark-parse` for Markdown → Recipe

**Principles:**
- **Extend existing services** (RecipeConverterService, HtmlReplacementService)
- **Bidirectional conversion** (ManagedRecipe ↔ Markdown ↔ HTML)
- **Preserve formatting** (bold, italic, links)
- **User edits** tracked via `source='user'` in ManagedField

**Next:** [Migration](./09-migration.md)
