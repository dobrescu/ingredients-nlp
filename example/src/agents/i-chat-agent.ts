import type { AIResponse } from "./chatgpt";

export interface ChatAgent {
  sendPrompt(systemPrompt: string, userPrompt: string): Promise<AIResponse>;
}
