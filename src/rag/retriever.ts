import type { Where } from "chromadb";
import { env } from "../config/env.js";
import type { CleanBook } from "../types/book.js";
import type { BookDocumentMetadata, CandidateBook } from "../types/rag.js";
import { getBookCollection } from "./chroma.js";
import { getEmbeddingProvider } from "./embeddings.js";

export interface RetrievalOptions {
  topK?: number;
  /** Extra structured constraints, ANDed with the base rag/domain filter. */
  where?: Where;
}

function metadataToCleanBook(metadata: BookDocumentMetadata): CleanBook {
  return {
    bookId: metadata.bookId,
    goodreadsBookId: metadata.goodreadsBookId,
    workId: metadata.workId,
    title: metadata.title,
    authors: metadata.authors,
    publicationYear: metadata.publicationYear ?? undefined,
    language: metadata.language ?? undefined,
    averageRating: metadata.averageRating,
    ratingsCount: metadata.ratingsCount,
    tags: metadata.tags,
  };
}

/**
 * Semantic retrieval only - no re-ranking, no LLM involvement. Every query
 * is scoped to this bot's own documents via the `rag`/`domain` metadata so
 * a shared/future multi-bot collection never leaks unrelated results in.
 */
export async function retrieveCandidateBooks(
  query: string,
  options: RetrievalOptions = {},
): Promise<CandidateBook[]> {
  const topK = options.topK ?? env.RETRIEVAL_TOP_K;

  // Chroma requires each `where` object to have exactly one top-level key,
  // so multi-field filters must be combined explicitly via $and.
  const scopeClauses: Where[] = [{ rag: "book_recommendation" }, { domain: "books" }];
  const where: Where = { $and: options.where ? [...scopeClauses, options.where] : scopeClauses };

  console.log(`[RETRIEVAL] Query: ${query}`);

  const embeddingProvider = getEmbeddingProvider();
  const queryEmbedding = await embeddingProvider.embedQuery(query);

  const collection = await getBookCollection();
  const result = await collection.query<BookDocumentMetadata>({
    queryEmbeddings: [queryEmbedding],
    nResults: topK,
    where,
    include: ["metadatas", "distances"],
  });

  const metadatas = result.metadatas[0] ?? [];
  const distances = result.distances[0] ?? [];

  const candidates: CandidateBook[] = metadatas
    .filter((metadata): metadata is BookDocumentMetadata => metadata !== null)
    .map((metadata, i) => ({
      book: metadataToCleanBook(metadata),
      score: typeof distances[i] === "number" ? 1 - distances[i] : 0,
    }));

  console.log(`[RETRIEVAL] Candidates: ${candidates.length}`);
  return candidates;
}
