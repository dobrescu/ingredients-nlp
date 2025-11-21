import type { PromptDefinition } from '../prompt-registry.js';
import type { HeadlineGenerationInput } from './headline-schema.js';

const systemPrompt = `Generate a catchy 5-12 word tagline for a recipe. Focus on what makes it special using sensory, appetizing language. Avoid generic phrases. Complement, don't repeat the recipe name.

Examples:
- "Fluffy, Buttery Layers That Melt in Your Mouth"
- "Bold Flavors Meet Irresistible Crunch"
- "Sweet, Tangy, and Perfectly Balanced"

Respond with JSON: {"headline": "your tagline"}`.trim();

const userPrompt = (input: HeadlineGenerationInput): string => {
	return input.description
		? `Recipe: ${input.name}\n${input.description}`
		: `Recipe: ${input.name}`;
};

const chatgptHeadlineV1: PromptDefinition<HeadlineGenerationInput> = {
	systemPrompt,
	userPrompt,
};

export default chatgptHeadlineV1;
