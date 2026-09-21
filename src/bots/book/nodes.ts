import type { Where } from "chromadb";
import { retrieveCandidateBooks } from "../../rag/retriever.js";
import { getReranker } from "../../rag/reranker.js";
import { buildRecommendationMessages, buildUnderstandingMessages } from "../../llm/prompts.js";
import { getChatModel } from "../../llm/model.js";
import { env } from "../../config/env.js";
import type { BookBotState, BookFilters } from "./state.js";
import { parseUnderstandingResponse } from "./understanding.js";
import { getTagVocabulary, TAG_HINTS } from "./tagVocabulary.js";

/** Dataset's language codes that mean "English" (see books.csv's language_code). */
const ENGLISH_LANGUAGE_CODES = ["eng", "en-US", "en-GB", "en-CA", "en"];

/** How many prior turns to feed the understanding step. */
const UNDERSTANDING_HISTORY_WINDOW = 4;

const NO_RESULTS_MESSAGE =
  "I couldn't find enough matching books in the current book database. Try loosening your constraints (rating, year, language) or describing what you're looking for differently.";

const OUT_OF_SCOPE_MESSAGE =
  "That doesn't look like a book-related request. I can help with book recommendations, genres, authors, or reading suggestions - please ask something book-related.";

/**
 * One structured-output LLM call that replaces three previously separate
 * mechanisms: rewriting a follow-up into a standalone question, checking
 * whether the (resolved) request is book-related, and extracting
 * structured filters. Seeing the full conversation and producing all three
 * outputs together lets the model tell "this follow-up still depends on
 * the last answer" apart from "this is a new topic", which regex/keyword
 * matching and separate single-purpose calls structurally couldn't do -
 * see understanding.ts for the response parsing/validation.
 */
export async function understandNode(state: BookBotState): Promise<Partial<BookBotState>> {
  const chatModel = getChatModel();
  const recentHistory = state.history.slice(-UNDERSTANDING_HISTORY_WINDOW);
  const validTags = await getTagVocabulary();

  const response = await chatModel.generate(
    buildUnderstandingMessages(recentHistory, state.query, TAG_HINTS),
    { temperature: 0, jsonMode: true },
  );

  const { inScope, resolvedQuery, filters } = parseUnderstandingResponse(
    response,
    state.query,
    validTags,
  );

  if (!inScope) {
    return { inScope, finalAnswer: OUT_OF_SCOPE_MESSAGE };
  }
  return { inScope, resolvedQuery, filters };
}

/**
 * Author matching happens client-side after retrieval (see filterBooksNode)
 * since Chroma's array `$contains` needs an exact element match and author
 * name formatting can vary. To still find the right book, pull a much
 * larger candidate pool before that filter narrows it back down - a plain
 * env.RETRIEVAL_TOP_K pool would often filter down to nothing even when a
 * matching book exists in the collection.
 */
const AUTHOR_FILTER_POOL_SIZE = 200;

function buildWhereFromFilters(filters: BookFilters): Where | undefined {
  const clauses: Where[] = [];

  if (filters.minRating !== undefined) {
    clauses.push({ averageRating: { $gte: filters.minRating } });
  }
  if (filters.maxRating !== undefined) {
    clauses.push({ averageRating: { $lte: filters.maxRating } });
  }
  if (filters.publishedAfter !== undefined) {
    clauses.push({ publicationYear: { $gte: filters.publishedAfter } });
  }
  if (filters.publishedBefore !== undefined) {
    clauses.push({ publicationYear: { $lte: filters.publishedBefore } });
  }
  if (filters.language) {
    const codes = filters.language === "eng" ? ENGLISH_LANGUAGE_CODES : [filters.language];
    clauses.push({ language: { $in: codes } });
  }
  for (const tag of filters.genreTags ?? []) {
    clauses.push({ tags: { $contains: tag } });
  }
  for (const tag of filters.excludeGenreTags ?? []) {
    clauses.push({ tags: { $not_contains: tag } });
  }

  if (clauses.length === 0) return undefined;
  return clauses.length === 1 ? clauses[0] : { $and: clauses };
}

export async function retrieveBooksNode(state: BookBotState): Promise<Partial<BookBotState>> {
  const where = buildWhereFromFilters(state.filters ?? {});
  const topK = state.filters?.author ? AUTHOR_FILTER_POOL_SIZE : undefined;
  const retrievedBooks = await retrieveCandidateBooks(state.resolvedQuery ?? state.query, {
    where,
    topK,
  });
  return { retrievedBooks };
}

/**
 * Post-retrieval refinement that Chroma's exact-match metadata filter
 * can't express cheaply (fuzzy author matching), plus the seam for a
 * future re-ranking stage (see rag/reranker.ts).
 */
export async function filterBooksNode(state: BookBotState): Promise<Partial<BookBotState>> {
  let candidates = state.retrievedBooks;

  const author = state.filters?.author?.toLowerCase();
  if (author) {
    candidates = candidates.filter((c) =>
      c.book.authors.some((a) => a.toLowerCase().includes(author)),
    );
  }

  const reranker = getReranker();
  const finalCandidates = await reranker.rerank(
    state.resolvedQuery ?? state.query,
    candidates,
    env.RETRIEVAL_TOP_K,
  );

  return { retrievedBooks: finalCandidates };
}

export async function generateRecommendationNode(
  state: BookBotState,
): Promise<Partial<BookBotState>> {
  const resolvedQuery = state.resolvedQuery ?? state.query;

  if (state.retrievedBooks.length === 0) {
    return { finalAnswer: NO_RESULTS_MESSAGE, history: [{ query: state.query, answer: NO_RESULTS_MESSAGE }] };
  }

  console.log("[LLM] Generating recommendation...");
  const chatModel = getChatModel();
  const messages = buildRecommendationMessages(resolvedQuery, state.retrievedBooks);
  const finalAnswer = await chatModel.generate(messages);

  return { finalAnswer, history: [{ query: state.query, answer: finalAnswer }] };
}
