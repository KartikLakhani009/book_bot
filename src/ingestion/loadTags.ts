import type { RawTagRow, RawBookTagRow } from "../types/book.js";

/**
 * Goodreads shelf tags that describe how a reader is using the book
 * (queue, ownership, format, personal rating) rather than what the book
 * actually is. These are noise for a genre/theme-based semantic query and
 * are dropped before a tag reaches a RAG document.
 */
const TAG_DENYLIST_PATTERNS: RegExp[] = [
  /^to-?read$/,
  /^currently-?reading$/,
  /^(did-not-finish|dnf|abandoned)$/,
  /favou?rites?$/,
  /^(books-i-own|owned(-books)?|my-books|my-library|i-own)$/,
  /^(wish-?list|to-buy|for-purchase)$/,
  /^(kindle|ebooks?|audiobooks?|paperback|hardcover|library)$/,
  /^default$/,
  /^(book-club|read-alikes?)$/,
  /^(re-?read|reread)s?$/,
  /^(20\d{2}-?reads?|read-in-20\d{2}|read-20\d{2})$/,
  /^(status-|shelfari-)/,
  /^[^a-z]*$/, // no letters at all, e.g. "--1-", "--10-", "-"
];

const MAX_TAGS_PER_BOOK = 8;

export function isUsefulTag(tagName: string): boolean {
  const name = tagName.trim().toLowerCase();
  if (!name) return false;
  return !TAG_DENYLIST_PATTERNS.some((pattern) => pattern.test(name));
}

/**
 * Joins book_tags.csv (goodreads_book_id -> tag_id, count) with tags.csv
 * (tag_id -> tag_name), drops shelf-management noise, and keeps the
 * top-weighted tags per book.
 *
 * Returns a Map keyed by goodreads_book_id (matches book_tags.csv, NOT the
 * internal sequential book_id used by books.csv/ratings.csv).
 */
export function buildTagsByGoodreadsBookId(
  tagRows: RawTagRow[],
  bookTagRows: RawBookTagRow[],
): Map<string, string[]> {
  const tagNameById = new Map<string, string>();
  for (const row of tagRows) {
    tagNameById.set(row.tag_id, row.tag_name);
  }

  const weighted = new Map<string, { name: string; count: number }[]>();
  for (const row of bookTagRows) {
    const tagName = tagNameById.get(row.tag_id);
    if (!tagName || !isUsefulTag(tagName)) continue;

    const count = Number(row.count);
    if (!Number.isFinite(count)) continue;

    const list = weighted.get(row.goodreads_book_id) ?? [];
    list.push({ name: tagName.trim().toLowerCase(), count });
    weighted.set(row.goodreads_book_id, list);
  }

  const result = new Map<string, string[]>();
  for (const [goodreadsBookId, entries] of weighted) {
    entries.sort((a, b) => b.count - a.count);
    result.set(
      goodreadsBookId,
      entries.slice(0, MAX_TAGS_PER_BOOK).map((e) => e.name),
    );
  }
  return result;
}
