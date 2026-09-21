import type { CleanBook, RawBookRow } from "../types/book.js";

export type CleanBookResult =
  | { ok: true; book: CleanBook }
  | { ok: false; bookId: string; reason: string };

function parseAuthors(raw: string): string[] {
  return raw
    .split(",")
    .map((a) => a.trim())
    .filter((a) => a.length > 0);
}

function parseOptionalYear(raw: string): number | undefined {
  if (!raw || raw.trim() === "") return undefined;
  const year = Number(raw);
  return Number.isFinite(year) ? Math.trunc(year) : undefined;
}

function parseOptionalLanguage(raw: string): string | undefined {
  const lang = raw.trim();
  return lang.length > 0 ? lang : undefined;
}

/**
 * Validates and normalizes one raw books.csv row into a CleanBook.
 * `tags` should already be filtered/ranked (see loadTags.ts) and keyed by
 * the row's goodreads_book_id by the caller.
 */
export function cleanBook(row: RawBookRow, tags: string[]): CleanBookResult {
  const bookId = Number(row.book_id);
  if (!Number.isFinite(bookId) || bookId <= 0) {
    return { ok: false, bookId: row.book_id, reason: "missing or invalid book_id" };
  }

  const goodreadsBookId = Number(row.goodreads_book_id);
  if (!Number.isFinite(goodreadsBookId) || goodreadsBookId <= 0) {
    return { ok: false, bookId: row.book_id, reason: "missing or invalid goodreads_book_id" };
  }

  const workId = Number(row.work_id);
  if (!Number.isFinite(workId) || workId <= 0) {
    return { ok: false, bookId: row.book_id, reason: "missing or invalid work_id" };
  }

  const title = row.title.trim();
  if (!title) {
    return { ok: false, bookId: row.book_id, reason: "missing title" };
  }

  const authors = parseAuthors(row.authors);
  if (authors.length === 0) {
    return { ok: false, bookId: row.book_id, reason: "missing authors" };
  }

  const averageRating = Number(row.average_rating);
  if (!Number.isFinite(averageRating)) {
    return { ok: false, bookId: row.book_id, reason: "missing or invalid average_rating" };
  }

  const ratingsCount = Number(row.ratings_count);
  if (!Number.isFinite(ratingsCount) || ratingsCount < 0) {
    return { ok: false, bookId: row.book_id, reason: "missing or invalid ratings_count" };
  }

  const book: CleanBook = {
    bookId,
    goodreadsBookId,
    workId,
    title,
    authors,
    publicationYear: parseOptionalYear(row.original_publication_year),
    language: parseOptionalLanguage(row.language_code),
    averageRating,
    ratingsCount,
    tags,
  };

  return { ok: true, book };
}
