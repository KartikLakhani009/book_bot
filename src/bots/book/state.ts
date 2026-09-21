import type { CandidateBook, ConversationTurn } from "../../types/rag.js";

export type { ConversationTurn };

export interface BookFilters {
  minRating?: number;
  maxRating?: number;
  publishedAfter?: number;
  publishedBefore?: number;
  language?: string;
  author?: string;
  /** Tag names (matching this dataset's tag vocabulary) the user asked for. */
  genreTags?: string[];
  /** Tag names the user explicitly asked to exclude (e.g. "not fantasy"). */
  excludeGenreTags?: string[];
}

export interface BookBotState {
  query: string;
  /** Set by understandNode; false short-circuits the graph straight to END. */
  inScope?: boolean;
  /** Prior turns for this thread (see graph.ts's MemorySaver checkpointer). */
  history: ConversationTurn[];
  /**
   * `query` rewritten into a standalone request using `history` (see
   * understandNode in nodes.ts) - e.g. "what about 4.24" -> "books rated
   * above 4.24". Retrieval/generation use this; `query`/`history` stay as
   * the original text for the next turn's context.
   */
  resolvedQuery?: string;
  filters?: BookFilters;
  retrievedBooks: CandidateBook[];
  finalAnswer?: string;
}
