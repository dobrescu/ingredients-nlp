import type { AIResponse, AIUsage } from "./chatgpt";
import type { ChatAgent } from "./i-chat-agent";
import { Model, getBedrockArn, DEFAULT_BEDROCK_MODEL } from "./models.js";
import {
	BedrockRuntimeClient,
	InvokeModelCommand,
	InvokeModelCommandOutput,
} from "@aws-sdk/client-bedrock-runtime";
import { logger } from "../utils/logger/logger.js";

/**
 * Bedrock API response structure
 */
interface BedrockResponse {
	content: Array<{ text?: string }>;
	usage?: {
		input_tokens?: number;
		output_tokens?: number;
	};
}

/**
 * Type guard for Bedrock response
 */
const isBedrockResponse = (value: unknown): value is BedrockResponse => {
	if (typeof value !== 'object' || value === null) return false;
	const obj = value as Record<string, unknown>;
	return (
		Array.isArray(obj.content) &&
		obj.content.every((c) => typeof c === 'object' && c !== null)
	);
};

/**
 * BedrockAgent supporting multiple Anthropic Claude profiles.
 * Defaults to Claude Sonnet 4 (20250514).
 * Compatible with Bedrock API schema bedrock-2023-05-31.
 */
export class BedrockAgent implements ChatAgent {
	private readonly client: BedrockRuntimeClient;
	private readonly maxTokens: number;
	private readonly inferenceProfileArn: string;

	constructor(
		model: Model = DEFAULT_BEDROCK_MODEL,
		region: string = "us-east-1",
		maxTokens: number = 4096
	) {
		this.client = new BedrockRuntimeClient({ region });
		this.maxTokens = maxTokens;
		this.inferenceProfileArn = getBedrockArn(model);
	}

	public async sendPrompt(systemPrompt: string, userPrompt: string): Promise<AIResponse> {
		const body = {
			anthropic_version: "bedrock-2023-05-31",
			system: systemPrompt,
			messages: [{ role: "user", content: userPrompt }],
			max_tokens: this.maxTokens,
			temperature: 0,
			top_p: 0.9,
		};

		const command = new InvokeModelCommand({
			modelId: this.inferenceProfileArn,
			contentType: "application/json",
			accept: "application/json",
			body: JSON.stringify(body),
		});

		try {
			const response: InvokeModelCommandOutput = await this.client.send(command);
			const raw = await response.body?.transformToString();
			if (!raw) throw new Error("Empty Bedrock response body");

			let parsed: unknown;
			try {
				parsed = JSON.parse(raw);
			} catch {
				const jsonStart = raw.indexOf("{");
				const jsonEnd = raw.lastIndexOf("}");
				if (jsonStart >= 0 && jsonEnd > jsonStart) {
					parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
				} else {
					throw new Error("Invalid JSON structure in response");
				}
			}

			if (!isBedrockResponse(parsed) || parsed.content.length === 0) {
				throw new Error(`Unexpected Bedrock response: ${raw}`);
			}

			const text = parsed.content
				.map((c) => c.text ?? "")
				.join("")
				.trim();

			const usage: AIUsage = {
				promptTokens: parsed.usage?.input_tokens ?? 0,
				completionTokens: parsed.usage?.output_tokens ?? 0,
				totalTokens:
					(parsed.usage?.input_tokens ?? 0) +
					(parsed.usage?.output_tokens ?? 0),
			};

			return { text, usage };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			logger.error('Bedrock invocation failed', { error, message });
			throw new Error(`Bedrock invocation failed: ${message}`);
		}
	}
}
