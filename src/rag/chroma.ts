import { ChromaClient, type Collection } from "chromadb";
import { env } from "../config/env.js";

let cachedClient: ChromaClient | undefined;
let cachedCollection: Collection | undefined;

function buildClient(): ChromaClient {
  const url = new URL(env.CHROMA_URL);
  return new ChromaClient({
    host: url.hostname,
    port: url.port ? Number(url.port) : undefined,
    ssl: url.protocol === "https:",
  });
}

export function getChromaClient(): ChromaClient {
  if (!cachedClient) {
    cachedClient = buildClient();
  }
  return cachedClient;
}

/**
 * We always supply pre-computed embeddings ourselves (see embeddings.ts),
 * so the collection is created with no default embedding function - Chroma
 * must never be asked to embed text on our behalf.
 */
export async function getBookCollection(): Promise<Collection> {
  if (!cachedCollection) {
    const client = getChromaClient();
    try {
      cachedCollection = await client.getOrCreateCollection({
        name: env.CHROMA_COLLECTION,
        embeddingFunction: null,
        metadata: {
          rag: "book_recommendation",
          domain: "books",
        },
      });
    } catch (err) {
      const typedErr = err as { cause?: { code?: string }; message?: string };
      if (typedErr.cause?.code === "ECONNREFUSED" || /fetch failed/i.test(typedErr.message ?? "")) {
        throw new Error(
          `Could not reach ChromaDB at ${env.CHROMA_URL}. Is the local server running? ` +
            `Start it with: npm run chroma:start`,
        );
      }
      throw err;
    }
  }
  return cachedCollection;
}
