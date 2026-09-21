import type { CleanBook, CleaningRejection, RawBookRow } from "../types/book.js";
import { cleanBook } from "./cleanBooks.js";

export interface MergeResult {
  books: CleanBook[];
  rejections: CleaningRejection[];
  duplicateBookIds: number[];
}

/**
 * Joins raw books.csv rows with tags (keyed by goodreads_book_id, see
 * loadTags.ts), validates/normalizes each row, and drops duplicate
 * book_ids (keeping the first occurrence).
 */
export function mergeBookData(
  rawBooks: RawBookRow[],
  tagsByGoodreadsBookId: Map<string, string[]>,
): MergeResult {
  const books: CleanBook[] = [];
  const rejections: CleaningRejection[] = [];
  const duplicateBookIds: number[] = [];
  const seenBookIds = new Set<number>();

  for (const row of rawBooks) {
    const tags = tagsByGoodreadsBookId.get(row.goodreads_book_id) ?? [];
    const result = cleanBook(row, tags);

    if (!result.ok) {
      rejections.push({ bookId: result.bookId, reason: result.reason });
      continue;
    }

    if (seenBookIds.has(result.book.bookId)) {
      duplicateBookIds.push(result.book.bookId);
      continue;
    }

    seenBookIds.add(result.book.bookId);
    books.push(result.book);
  }

  return { books, rejections, duplicateBookIds };
}
