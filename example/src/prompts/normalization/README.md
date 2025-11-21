# Recipe Normalization

Extracts structured recipe data from HTML.

## Files

- `bedrock.v1.ts` - Claude prompt
- `chatgpt.v1.ts` - ChatGPT prompt (with function calling)
- `recipe-schema.ts` - Validation schema

## Schema

Extracts:
- Basic info (name, description, headline, times, servings)
- Ingredients (grouped, with quantity/unit/name)
- Directions (sectioned steps)
- Nutrition, storage, tips, allergens

## Agent Support

- **Bedrock (Claude 3.5 Haiku)** - Uses system prompt
- **ChatGPT (GPT-4 Turbo)** - Uses function calling for structured output

## Extension

To add a new agent:
1. Create `{agent}.v1.ts` with prompts
2. Export from `index.ts`
3. Register in `prompt-registry.ts`
