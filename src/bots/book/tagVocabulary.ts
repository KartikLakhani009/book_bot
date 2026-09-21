import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { CleanBook } from "../../types/book.js";

const DATA_PATH = resolve(process.cwd(), "data/processed/books.cleaned.json");

/**
 * Small curated subset shown directly in the understanding prompt to guide
 * the model (kept short to bound token cost) - NOT the full validation
 * vocabulary. Pulled from the dataset's actual most-common tags, see
 * ingestion/loadTags.ts for the denylist that already strips shelf noise.
 */
export const TAG_HINTS = [
  "fantasy",
  "science-fiction",
  "sci-fi",
  "romance",
  "mystery",
  "thriller",
  "horror",
  "historical-fiction",
  "classics",
  "young-adult",
  "non-fiction",
  "adventure",
  "paranormal",
  "urban-fantasy",
  "dystopia",
  "graphic-novels",
  "poetry",
  "biography",
  "crime",
  "humor",
  "suspense",
  "memoir",
  "war",
  "spy",
  "espionage",
  "philosophy",
  "religion",
  "self-help",
  "psychology",
  "true-crime",
  "travel",
  "contemporary",
];

let cachedVocabulary: Set<string> | undefined;

/**
 * Full tag vocabulary actually present in the dataset (hundreds of
 * distinct values, well beyond TAG_HINTS), used to silently drop any tag
 * the understanding LLM invents that doesn't exist in Chroma - filtering
 * on a tag that can never match would just return zero results.
 */
export async function getTagVocabulary(): Promise<Set<string> | undefined> {
  if (cachedVocabulary) return cachedVocabulary;

  try {
    const raw = await readFile(DATA_PATH, "utf-8");
    const books: CleanBook[] = JSON.parse(raw);
    cachedVocabulary = new Set(books.flatMap((book) => book.tags));
    return cachedVocabulary;
  } catch {
    console.warn(
      `[UNDERSTANDING] Could not read ${DATA_PATH} to validate genre tags - skipping tag validation for this process.`,
    );
    return undefined;
  }
}
