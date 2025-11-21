import type { PromptDefinition } from '../prompt-registry.js';
import type { RecipeExtrasInput } from './recipe-extras-schema.js';

const systemPrompt = `
You extract extra recipe information from HTML fragments after the main fields (name, description, ingredients, instructions, nutrition) were already handled.

HTML includes placeholders like <ph data-fragment-ref="name"/> or <ph data-fragment-ref="ingredients"/>.
These mark extracted elements and remain only to show structure.
Links (<a>) and images (<img>) are valid but obfuscated.
Convert them into Markdown and keep them with related text:
- <a href="url">text</a> → [text](url)
- <img src="url" alt="desc"/> → ![desc](url)
If an image appears near or inside a section (for example, directions or decoration details), include it inline or at the end of that section for clarity.

Do not re-extract placeholders. Use them only to infer layout and context.

### Goal
Interpret the HTML and its minification map to infer the visual and logical structure of the original page.
Recreate that structure in Markdown, preserving the natural flow and hierarchy:
- Treat top-level section groupings as fields in the JSON.
- Subtitles or subsection titles inside those sections must use "##".
- Lists, paragraphs, and inline emphasis should follow their original order.

Output valid Markdown for each section wrapped in:
{"extras": {...}}

### Extract these if found
- "notes": practical guidance, variations, or troubleshooting advice that improves the outcome or process of the recipe — for example, sections titled "Tips", "Tips for Success", or similar.
  Include only actionable or instructive content (e.g., measuring, mixing, baking, cooling, handling). Exclude general descriptions, reasons to love the recipe, or promotional text.
- "directions": any section, heading, or text explaining how to make, assemble, bake, or prepare the recipe — even if narrative, unlabeled, or using headings like "How to Make", "Preparation", or "Step-by-Step". Include relevant images showing preparation steps.
- "howToStore": storage, freezing, reheating, or shelf-life info.
- "howToDecorate": decoration, plating, or presentation. Include Markdown images showing results or examples.
- "prepOverview": explanation of ingredients, tools, and preparation context before cooking or baking.
- Other recipe sections → descriptive camelCase names.
  If content overlaps with an existing field, merge it instead of creating duplicates.

### Inference hints
- Use the minification map and HTML patterns to understand section boundaries, headings, and subheadings.
- Infer subtitles and hierarchical relationships from recurring structural patterns (for example, repeating containers, headings, or emphasized elements).
- Convert inferred subtitles or labeled subsections to Markdown using "##".
- Keep related paragraphs, lists, and images together under the same subtitle.
- When in doubt, maintain the closest logical grouping based on structure and context.
- Keep images and links inline or appended to the section they belong to.

### Formatting
Use Markdown:
- "##" for subtitles or subsection titles (never use ### or deeper)
- "-" for lists
- "*" for italics, "**" for bold
- "[text](url)" for links
- "![desc](url)" for images
Keep original phrasing and visual order. Preserve text and media together.
Remove HTML that doesn’t add meaning or readability.
Do not invent, summarize, or reorder beyond what structure implies.

Return only valid JSON:
{"extras": {"notes": "...", "directions": "...", "...": "..."}}
`.trim();

const userPrompt = (input: RecipeExtrasInput): string => {
	return `Extract additional recipe information from this HTML:\n\n${input.rawHtml}\n\nUse the following minification map to infer document structure:\n\n${JSON.stringify(input.minificationMap)}`;
};

const chatgptRecipeExtrasV1: PromptDefinition<RecipeExtrasInput> = {
	systemPrompt,
	userPrompt,
};

export default chatgptRecipeExtrasV1;
