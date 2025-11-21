/**
 * Headline Generation Module
 *
 * Clean implementation using existing infrastructure:
 * - chat-agent-factory for agent creation
 * - prompt-registry for prompt management
 * - Schema validation for type safety
 *
 * To add a new agent:
 * 1. Create prompts/generate-headline/{agent}.v1.ts
 * 2. Register in prompt-registry.ts
 * Done!
 */

export { HeadlineGenerationService } from './headline-service.js';
export { HeadlineSchema, validateHeadlineResponse } from './headline-schema.js';
export type { HeadlineGenerationInput, HeadlineGenerationResponse } from './headline-schema.js';
