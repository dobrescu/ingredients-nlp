/**
 * Chat Agent Factory
 * Creates chat agents from Model enum with automatic provider inference
 */

import { BedrockAgent } from "./bedrock.js";
import { ChatGPTAgent } from "./chatgpt.js";
import type { ChatAgent } from "./i-chat-agent.js";
import { Model, getProviderFromModel } from "./models.js";

/**
 * Create chat agent from Model enum
 * Provider is automatically inferred from the model
 */
export function createChatAgent(model: Model): ChatAgent {
  const provider = getProviderFromModel(model);

  switch (provider) {
    case 'chatgpt':
      return new ChatGPTAgent(model);
    case 'bedrock':
      return new BedrockAgent(model);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}
