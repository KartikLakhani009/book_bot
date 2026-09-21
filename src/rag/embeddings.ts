import { VoyageAIClient } from "voyageai";
import { env } from "../config/env.js";
import { callWithRetry } from "../lib/retryWithBackoff.js";
import type { EmbeddingProvider } from "../types/rag.js";

/** Also Voyage's own per-request input cap - keep callers batching at this size. */
export const EMBEDDING_BATCH_SIZE = 128;

function logRetry(label: string) {
  return (info: { attempt: number; maxAttempts: number; statusCode?: number; delayMs: number }) => {
    console.warn(
      `[EMBEDDING] ${label} failed (status ${info.statusCode}, attempt ${info.attempt}/${info.maxAttempts}). ` +
        `Retrying in ${Math.round(info.delayMs / 1000)}s...`,
    );
  };
}

export class VoyageEmbeddingProvider implements EmbeddingProvider {
  readonly modelName: string;
  private readonly client: VoyageAIClient;

  constructor(apiKey: string = env.VOYAGE_API_KEY, modelName: string = env.VOYAGE_EMBEDDING_MODEL) {
    this.client = new VoyageAIClient({ apiKey });
    this.modelName = modelName;
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
      const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);
      const response = await callWithRetry(
        () =>
          this.client.embed({
            input: batch,
            model: this.modelName,
            inputType: "document",
          }),
        { onRetry: logRetry(`embedDocuments (${batch.length} texts, offset ${i})`) },
      );
      const batchEmbeddings = response.data?.map((item) => item.embedding ?? []);
      if (!batchEmbeddings || batchEmbeddings.length !== batch.length) {
        throw new Error(
          `Voyage embedding API returned ${batchEmbeddings?.length ?? 0} embeddings for a batch of ${batch.length} inputs`,
        );
      }
      embeddings.push(...batchEmbeddings);
    }
    return embeddings;
  }

  async embedQuery(text: string): Promise<number[]> {
    const response = await callWithRetry(
      () =>
        this.client.embed({
          input: [text],
          model: this.modelName,
          inputType: "query",
        }),
      { onRetry: logRetry("embedQuery") },
    );
    const embedding = response.data?.[0]?.embedding;
    if (!embedding) {
      throw new Error("Voyage embedding API returned no embedding for query");
    }
    return embedding;
  }
}

let cachedProvider: EmbeddingProvider | undefined;

/** Swap the embedding backend here without touching any caller. */
export function getEmbeddingProvider(): EmbeddingProvider {
  if (!cachedProvider) {
    cachedProvider = new VoyageEmbeddingProvider();
  }
  return cachedProvider;
}
