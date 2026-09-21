import Groq from "groq-sdk";
import { env } from "../config/env.js";
import { callWithRetry } from "../lib/retryWithBackoff.js";
import type { ChatGenerateOptions, ChatMessage, ChatModel } from "../types/rag.js";

export class GroqChatModel implements ChatModel {
  readonly modelName: string;
  private readonly client: Groq;

  constructor(apiKey: string = env.GROQ_API_KEY, modelName: string = env.GROQ_MODEL) {
    this.client = new Groq({ apiKey });
    this.modelName = modelName;
  }

  async generate(messages: ChatMessage[], options?: ChatGenerateOptions): Promise<string> {
    const completion = await callWithRetry(
      () =>
        this.client.chat.completions.create({
          model: this.modelName,
          messages,
          temperature: options?.temperature ?? 0.3,
          response_format: options?.jsonMode ? { type: "json_object" } : undefined,
        }),
      {
        onRetry: (info) =>
          console.warn(
            `[LLM] Groq call failed (status ${info.statusCode}, attempt ${info.attempt}/${info.maxAttempts}). ` +
              `Retrying in ${Math.round(info.delayMs / 1000)}s...`,
          ),
      },
    );

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Groq API returned an empty response");
    }
    return content;
  }
}

let cachedModel: ChatModel | undefined;

/** Swap the LLM backend here without touching any caller. */
export function getChatModel(): ChatModel {
  if (!cachedModel) {
    cachedModel = new GroqChatModel();
  }
  return cachedModel;
}
