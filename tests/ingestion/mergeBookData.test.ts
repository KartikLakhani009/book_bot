import { describe, expect, it } from "vitest";
import { mergeBookData } from "../../src/ingestion/mergeBookData.js";
import type { RawBookRow } from "../../src/types/book.js";

function makeRow(overrides: Partial<RawBookRow> = {}): RawBookRow {
  return {
    book_id: "1",
    goodreads_book_id: "100",
    best_book_id: "100",
    work_id: "1000",
    books_count: "1",
    isbn: "",
    isbn13: "",
    authors: "Author One",
    original_publication_year: "2000",
    original_title: "",
    title: "Book One",
    language_code: "eng",
    average_rating: "4.0",
    ratings_count: "100",
    work_ratings_count: "100",
    work_text_reviews_count: "10",
    ratings_1: "0",
    ratings_2: "0",
    ratings_3: "0",
    ratings_4: "0",
    ratings_5: "0",
    image_url: "",
    small_image_url: "",
    ...overrides,
  };
}

describe("mergeBookData", () => {
  it("attaches tags by goodreads_book_id, not the internal book_id", () => {
    const rows = [makeRow()];
    const tagsMap = new Map([["100", ["fantasy"]]]);
    const { books } = mergeBookData(rows, tagsMap);
    expect(books).toHaveLength(1);
    expect(books[0].tags).toEqual(["fantasy"]);
  });

  it("collects rejections instead of throwing", () => {
    const rows = [makeRow({ book_id: "1" }), makeRow({ book_id: "", goodreads_book_id: "101" })];
    const { books, rejections } = mergeBookData(rows, new Map());
    expect(books).toHaveLength(1);
    expect(rejections).toHaveLength(1);
  });

  it("drops duplicate book_ids, keeping the first occurrence", () => {
    const rows = [
      makeRow({ book_id: "1", title: "First" }),
      makeRow({ book_id: "1", title: "Duplicate" }),
    ];
    const { books, duplicateBookIds } = mergeBookData(rows, new Map());
    expect(books).toHaveLength(1);
    expect(books[0].title).toBe("First");
    expect(duplicateBookIds).toEqual([1]);
  });
});
