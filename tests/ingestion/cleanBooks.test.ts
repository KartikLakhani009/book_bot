import { describe, expect, it } from "vitest";
import { cleanBook } from "../../src/ingestion/cleanBooks.js";
import type { RawBookRow } from "../../src/types/book.js";

function makeRow(overrides: Partial<RawBookRow> = {}): RawBookRow {
  return {
    book_id: "1",
    goodreads_book_id: "2767052",
    best_book_id: "2767052",
    work_id: "2792775",
    books_count: "272",
    isbn: "439023483",
    isbn13: "9780439023481",
    authors: "Suzanne Collins",
    original_publication_year: "2008",
    original_title: "The Hunger Games",
    title: "The Hunger Games (The Hunger Games, #1)",
    language_code: "eng",
    average_rating: "4.34",
    ratings_count: "4780653",
    work_ratings_count: "4942365",
    work_text_reviews_count: "155254",
    ratings_1: "66715",
    ratings_2: "127936",
    ratings_3: "560092",
    ratings_4: "1481305",
    ratings_5: "2706317",
    image_url: "",
    small_image_url: "",
    ...overrides,
  };
}

describe("cleanBook", () => {
  it("normalizes a valid row into a CleanBook", () => {
    const result = cleanBook(makeRow(), ["fantasy", "adventure"]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.book).toEqual({
      bookId: 1,
      goodreadsBookId: 2767052,
      workId: 2792775,
      title: "The Hunger Games (The Hunger Games, #1)",
      authors: ["Suzanne Collins"],
      publicationYear: 2008,
      language: "eng",
      averageRating: 4.34,
      ratingsCount: 4780653,
      tags: ["fantasy", "adventure"],
    });
  });

  it("splits multiple comma-separated authors", () => {
    const result = cleanBook(makeRow({ authors: "J.K. Rowling, Mary GrandPré" }), []);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.book.authors).toEqual(["J.K. Rowling", "Mary GrandPré"]);
  });

  it("rejects a row with no book_id", () => {
    const result = cleanBook(makeRow({ book_id: "" }), []);
    expect(result.ok).toBe(false);
  });

  it("rejects a row with no title", () => {
    const result = cleanBook(makeRow({ title: "" }), []);
    expect(result.ok).toBe(false);
  });

  it("rejects a row with no authors", () => {
    const result = cleanBook(makeRow({ authors: "" }), []);
    expect(result.ok).toBe(false);
  });

  it("leaves publicationYear undefined when missing, without rejecting the book", () => {
    const result = cleanBook(makeRow({ original_publication_year: "" }), []);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.book.publicationYear).toBeUndefined();
  });

  it("keeps negative (BC) publication years", () => {
    const result = cleanBook(makeRow({ original_publication_year: "-750" }), []);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.book.publicationYear).toBe(-750);
  });

  it("leaves language undefined when missing, without rejecting the book", () => {
    const result = cleanBook(makeRow({ language_code: "" }), []);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.book.language).toBeUndefined();
  });
});
