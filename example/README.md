# TODO
Add posibility of having interval in the number of servers, in html (12-14 slices converts to 12)
Take the fucking steps from JSON LD https://www.lifeloveandsugar.com/moist-vanilla-layer-cake/ and don't send the json+ld and the html content to chatty. Ask him only about

# api
http://localhost:3000/loadRecipe?url=https://sallysbakingaddiction.com/best-banana-cake/
http://localhost:3000/loadRecipe?url=https://feelgoodfoodie.net/recipe/ground-beef-tacos-napa-cabbage-guacamole/

## AgentService Usage

The `AgentService` provides a clean abstraction for processing recipe data using AI agents. It handles chat agent creation, prompt execution, response parsing, performance metrics, and recipe enhancement with media data.

### Basic Usage

```typescript
import { AgentService } from './agent-service.js';

// Create service with configuration
const agentService = new AgentService({
  agent: 'chatgpt',           // 'chatgpt' | 'bedrock'
  promptType: 'normalization', // Currently supports 'normalization'
  promptVersion: 'v1',        // Version of the prompt to use
  enableLogging: true,        // Enable/disable console logging
  enableTiming: true,         // Enable/disable performance timing
});

// Process recipe data
const result = await agentService.processRecipeData(websiteData);
console.log(`Recipe processed in ${result.processingTime}s`);
if (result.usage) {
  console.log(`Tokens used: ${result.usage.totalTokens}`);
}
```

### Factory Methods

```typescript
// Create with default ChatGPT configuration
const defaultService = AgentService.createDefault();

// Create with custom configuration
const customService = AgentService.create({
  agent: 'bedrock',
  promptType: 'normalization',
  promptVersion: 'v1',
  enableLogging: false,  // Silent for production
});
```

### Advanced Usage Examples

```typescript
// Process with multiple agents for comparison
const chatgptService = AgentService.create({
  agent: 'chatgpt',
  promptType: 'normalization',
  promptVersion: 'v1'
});
const bedrockService = AgentService.create({
  agent: 'bedrock',
  promptType: 'normalization',
  promptVersion: 'v1'
});

const [chatgptResult, bedrockResult] = await Promise.all([
  chatgptService.processRecipeData(data),
  bedrockService.processRecipeData(data)
]);

// Use the faster result
const finalResult = chatgptResult.processingTime < bedrockResult.processingTime
  ? chatgptResult.recipe
  : bedrockResult.recipe;
```

### Return Types

```typescript
interface ProcessingResult {
  recipe: unknown;           // The parsed recipe object
  processingTime: number;    // Processing time in seconds
  usage?: {                  // Token usage (if available)
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
```

### Error Handling

The service includes comprehensive error handling:
- Input validation for recipe data structure
- AI response validation and parsing
- Detailed error messages with context
- Graceful handling of missing token usage data

All processing errors are wrapped with descriptive messages to help with debugging.



http://localhost:3000/loadRecipe?url=https://spanishsabores.com/croquetas-de-jamon-serrano-recipe-ham-croquettes/

gets wrong seves number
the type="application/ld+json is not passed properly








//TODO
- [ ] Cost per improvement (track LLM token usage)
- [ ] rename looking for an agent and just be able to trigger the agent by running the model. The family, bedrock or chatgpt should be inferred from the model. Make a nice way to do it.
- [ ] make it accept also user recipe, update it and then update the base recipe as well
- store the hash of the object somewhere(make sure not to include the hash when you hash, so it's all minus hash) and a metadata about the models that ran with each prompts. prompt and models 1:1. actionaly store the metadata on the section. and make it historical
- [ ] make the html covert back the text by looking for the ids that it placed and specially replacing bakc the a and the img who are markdown now. Rewrite the whole thing properly to include to restore from HTML or from Markdown


--- prompts to make ---

sections:
= name
= description
= recipeIngredient
= recipeInstructions
= prepDetails
= notes
= storageInstructions (howToStore)
= decorationTips (howToDecorate)
= recipeEquipment
= recipeVariations
= servingSuggestions (howToServe)
= pairingSuggestions (howToPair)



Header Card	name, description, prepDetails	Top hero section
Main Recipe Flow	recipeIngredient, recipeInstructions	Always expanded
Extra Drawer: Chef’s Notes	notes, recipeVariations, recipeEquipment	Tips and prep guidance
Extra Drawer: Presentation	decorationTips, servingSuggestions, pairingSuggestions	Aesthetic and pairing info
Extra Drawer: Storage	storageInstructions	Post-cooking



check ingredients (obj and html) and collect allergens
check instructions and infer the equiepment needed, difficulty, time for preparation, time for cooking
