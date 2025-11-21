import type { PromptDefinition } from "../prompt-registry.js";
import type { RecipeExtrasInput } from "./recipe-extras-schema.js";

const systemPrompt = `
You extract additional recipe information from HTML fragments after the main fields
(name, description, ingredients, instructions, nutrition) were already processed.

Placeholders like <ph data-fragment-ref="name"/> or <ph data-fragment-ref="ingredients"/>
indicate extracted sections. Do not re-extract them. Use them only to infer layout and context.

Links (<a>) and images (<img>) are valid. Convert them to Markdown and keep them near related text:
- <a href="url">text</a> → [text](url)
- <img src="url" alt="desc"/> → ![desc](url)
If an image appears inside or near a section (for example, directions or decoration),
include it inline or at the end of that section.

### Goal
Infer structure using both the HTML and the minification map.
Rebuild that structure in Markdown, keeping logical order and relationships:
- Each top-level section becomes a JSON field.
- Inside each section, use "##" for subtitles only (no deeper levels).
- Preserve order of paragraphs, lists, emphasis, links, and images.

Return **only** valid JSON, with no commentary, code fences, or explanation:
{"extras": {...}}

### Extract these if found
- "notes": practical guidance, variations, or troubleshooting tips that improve the recipe’s process or results.
  Match headings such as "Tips", "Tips for Success", or similar.
  Include actionable or instructive content (measuring, mixing, baking, cooling, handling).
  Exclude descriptions, “why you’ll love it” text, or promotional tone.
- "directions": any section or text describing how to make, assemble, bake, or prepare the recipe —
  even if untitled or labeled “How to Make”, “Preparation”, or “Step-by-Step”. Include related preparation images.
- "howToStore": storage, freezing, reheating, or shelf-life details.
- "howToDecorate": decoration, plating, or presentation. Include relevant images.
- "prepOverview": information about ingredients, tools, or setup needed before cooking or baking (for example, a “What You’ll Need” section).
- Other recipe sections → use descriptive camelCase keys. Merge overlapping content rather than duplicating.

### Inference rules
- Use the minification map and HTML cues to detect section boundaries and hierarchy.
- Infer subtitles or subtopics from repeating structures (containers, emphasized headings, visual groups).
- Convert inferred subtitles to "##".
- Keep related paragraphs, lists, and images grouped under their subtitle.
- If uncertain, group content by meaning and proximity, not tag names.
- Keep images and links inline or appended to their relevant section.

### Markdown formatting
- "##" for subtitles
- "-" for lists
- "*" for italics, "**" for bold
- "[text](url)" for links
- "![desc](url)" for images

Preserve original phrasing and sequence.
Keep text and media together.
Remove HTML that adds no value.
Do not summarize, invent, or reorder beyond what the structure implies.
`.trim();

const userPrompt = (input: RecipeExtrasInput): string => {
	return `
Return only valid JSON without markdown or commentary.
Extract additional recipe information from this HTML:

${input.rawHtml}

Use this minification map to infer structure:

${JSON.stringify(input.minificationMap)}
`.trim();
};

const chatclaudeRecipeExtrasV1: PromptDefinition<RecipeExtrasInput> = {
	systemPrompt,
	userPrompt,
};

export default chatclaudeRecipeExtrasV1;
