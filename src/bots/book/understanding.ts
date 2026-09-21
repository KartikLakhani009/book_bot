import { z } from "zod";
import type { BookFilters } from "./state.js";

const filtersSchema = z.object({
  minRating: z.number().min(0).max(5).optional(),
  maxRating: z.number().min(0).max(5).optional(),
  publishedAfter: z.number().int().optional(),
  publishedBefore: z.number().int().optional(),
  language: z.string().min(1).optional(),
  author: z.string().min(1).optional(),
  genreTags: z.array(z.string()).optional(),
  excludeGenreTags: z.array(z.string()).optional(),
});

const understandingSchema = z.object({
  inScope: z.boolean(),
  resolvedQuery: z.string().min(1),
  filters: filtersSchema.optional(),
});

export interface UnderstandingResult {
  inScope: boolean;
  resolvedQuery: string;
  filters: BookFilters;
}

function dropUnknownTags(
  tags: string[] | undefined,
  validTags: Set<string> | undefined,
): string[] | undefined {
  if (!tags || tags.length === 0) return undefined;
  if (!validTags) return tags; // vocabulary unavailable - trust the model
  const kept = tags.filter((tag) => validTags.has(tag));
  return kept.length > 0 ? kept : undefined;
}

/** Models sometimes wrap JSON in a markdown code fence despite instructions not to. */
function stripCodeFence(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
}

/**
 * Parses/validates the understanding LLM call's JSON output. Never throws -
 * a malformed or unparseable response falls back to "treat as in-scope, no
 * structured filters, search the raw query semantically" so one bad
 * completion never blocks a legitimate request; it just degrades to a
 * plain semantic search for that turn.
 */
export function parseUnderstandingResponse(
  raw: string,
  fallbackQuery: string,
  validTags?: Set<string>,
): UnderstandingResult {
  const fallback: UnderstandingResult = { inScope: true, resolvedQuery: fallbackQuery, filters: {} };

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(stripCodeFence(raw));
  } catch {
    console.warn("[UNDERSTANDING] Non-JSON response, falling back to unfiltered semantic search.");
    return fallback;
  }

  const parsed = understandingSchema.safeParse(parsedJson);
  if (!parsed.success) {
    console.warn(
      "[UNDERSTANDING] Response failed schema validation, falling back to unfiltered semantic search.",
    );
    return fallback;
  }

  const rawFilters = parsed.data.filters ?? {};
  const filters: BookFilters = {
    ...rawFilters,
    genreTags: dropUnknownTags(rawFilters.genreTags, validTags),
    excludeGenreTags: dropUnknownTags(rawFilters.excludeGenreTags, validTags),
  };

  return {
    inScope: parsed.data.inScope,
    resolvedQuery: parsed.data.resolvedQuery || fallbackQuery,
    filters,
  };
}
