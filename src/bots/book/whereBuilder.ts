import type { Where } from "chromadb";
import type { BookFilters } from "./state.js";

/** Dataset's language codes that mean "English" (see books.csv's language_code). */
export const ENGLISH_LANGUAGE_CODES = ["eng", "en-US", "en-GB", "en-CA", "en"];

/**
 * Translates structured filters (extracted by understandNode) into a Chroma
 * `where` clause. Chroma requires every `where` object to have exactly one
 * top-level key, so two or more clauses must be combined explicitly via
 * `$and` - a plain `{ a, b }` object is rejected at query time. See
 * rag/retriever.ts for the same constraint applied to the base rag/domain
 * scoping filter.
 */
export function buildWhereFromFilters(filters: BookFilters): Where | undefined {
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
