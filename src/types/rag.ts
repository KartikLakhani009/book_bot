import type { CleanBook } from "./book.js";

/**
 * Metadata stored on every ChromaDB document for this bot.
 * `rag`/`domain` identify ownership so a future multi-bot LangGraph app can
 * filter this bot's documents out of a shared vector store.
 */
export interface BookDocumentMetadata {
  // Chroma's Metadata type requires a string index signature; every field
  // below must stay within this union.
  [key: string]: boolean | number | string | string[] | number[] | boolean[] | null;

  rag: "book_recommendation";
  domain: "books";

  source: "goodbooks-10k";
  sourceType: "dataset";
  version: "v1";
  documentType: "book";

  bookId: number;
  goodreadsBookId: number;
  workId: number;

  title: string;
  authors: string[];

  publicationYear: number | null;
  language: string | null;

  averageRating: number;
  ratingsCount: number;

  tags: string[];
}

/** Swappable embedding backend. Implement this to switch providers later. */
export interface EmbeddingProvider {
  readonly modelName: string;
  embedDocuments(texts: string[]): Promise<number[][]>;
  embedQuery(text: string): Promise<number[]>;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatGenerateOptions {
  /** Lower for deterministic tasks (classification), higher for open generation. */
  temperature?: number;
  /** Ask the model to return a raw JSON object. Providers without native
   * JSON-mode support may ignore this and rely on prompt instructions alone. */
  jsonMode?: boolean;
}

/** Swappable chat/completion backend. Implement this to switch LLMs later. */
export interface ChatModel {
  readonly modelName: string;
  generate(messages: ChatMessage[], options?: ChatGenerateOptions): Promise<string>;
}

export interface CandidateBook {
  book: CleanBook;
  /** Similarity score from vector search (higher = more relevant). */
  score: number;
}

/** One turn of a book-bot conversation, used for multi-turn context. */
export interface ConversationTurn {
  query: string;
  answer: string;
}

/**
 * Not implemented in v1 (see project constraints). Retrieval returns
 * candidates already ranked by vector similarity; this interface exists so
 * a real re-ranking stage (e.g. Voyage rerank) can be dropped in later
 * without changing callers.
 */
export interface Reranker {
  rerank(
    query: string,
    candidates: CandidateBook[],
    topN: number,
  ): Promise<CandidateBook[]>;
}
