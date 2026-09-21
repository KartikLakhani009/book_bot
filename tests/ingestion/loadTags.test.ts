import { describe, expect, it } from "vitest";
import { buildTagsByGoodreadsBookId, isUsefulTag } from "../../src/ingestion/loadTags.js";
import type { RawBookTagRow, RawTagRow } from "../../src/types/book.js";

describe("isUsefulTag", () => {
  it("drops shelf-management tags", () => {
    expect(isUsefulTag("to-read")).toBe(false);
    expect(isUsefulTag("currently-reading")).toBe(false);
    expect(isUsefulTag("owned-books")).toBe(false);
    expect(isUsefulTag("favorites")).toBe(false);
    expect(isUsefulTag("kindle")).toBe(false);
    expect(isUsefulTag("--1-")).toBe(false);
  });

  it("keeps genre/theme tags", () => {
    expect(isUsefulTag("fantasy")).toBe(true);
    expect(isUsefulTag("science-fiction")).toBe(true);
    expect(isUsefulTag("historical-fiction")).toBe(true);
  });
});

describe("buildTagsByGoodreadsBookId", () => {
  const tags: RawTagRow[] = [
    { tag_id: "1", tag_name: "fantasy" },
    { tag_id: "2", tag_name: "to-read" },
    { tag_id: "3", tag_name: "adventure" },
    { tag_id: "4", tag_name: "magic" },
  ];

  it("joins by goodreads_book_id, drops noise, sorts by count desc", () => {
    const bookTags: RawBookTagRow[] = [
      { goodreads_book_id: "100", tag_id: "2", count: "99999" }, // noise, dropped
      { goodreads_book_id: "100", tag_id: "3", count: "50" },
      { goodreads_book_id: "100", tag_id: "1", count: "200" },
      { goodreads_book_id: "100", tag_id: "4", count: "150" },
    ];

    const result = buildTagsByGoodreadsBookId(tags, bookTags);
    expect(result.get("100")).toEqual(["fantasy", "magic", "adventure"]);
  });

  it("caps tags per book at 8", () => {
    const manyTags: RawTagRow[] = Array.from({ length: 10 }, (_, i) => ({
      tag_id: String(i),
      tag_name: `tag-${i}`,
    }));
    const manyBookTags: RawBookTagRow[] = manyTags.map((t, i) => ({
      goodreads_book_id: "1",
      tag_id: t.tag_id,
      count: String(10 - i),
    }));

    const result = buildTagsByGoodreadsBookId(manyTags, manyBookTags);
    expect(result.get("1")).toHaveLength(8);
  });

  it("returns no entry for a book with no useful tags", () => {
    const bookTags: RawBookTagRow[] = [{ goodreads_book_id: "200", tag_id: "2", count: "10" }];
    const result = buildTagsByGoodreadsBookId(tags, bookTags);
    expect(result.has("200")).toBe(false);
  });
});
