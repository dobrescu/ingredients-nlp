# Headline Generation

Generates catchy taglines for recipes when headline field is missing.

## Files

- `bedrock.v1.ts` - Claude prompt
- `chatgpt.v1.ts` - ChatGPT prompt
- `headline-schema.ts` - Validation schema
- `headline-service.ts` - Service implementation

## Usage

```typescript
import { HeadlineGenerationService } from './prompts/generate-headline';

const service = HeadlineGenerationService.create('bedrock');
const result = await service.generateHeadline({
  name: "Chocolate Chip Cookies",
  description: "Soft, chewy cookies"
});
// => { headline: "Chewy, Buttery Bliss in Every Bite" }
```

## Agent Support

- **Bedrock (Claude 3.5 Haiku)** - Default, cost-efficient
- **ChatGPT (GPT-4 Turbo)** - Alternative

## Extension

To add a new agent:
1. Create `{agent}.v1.ts` with system/user prompts
2. Export from `index.ts`
3. Register in `prompt-registry.ts`
