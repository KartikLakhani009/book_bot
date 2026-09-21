import { describe, expect, it } from "vitest";
import { buildBookDocument } from "../../src/rag/documents.js";
import type { CleanBook } from "../../src/types/book.js";

const book: CleanBook = {
  bookId: 1,
  goodreadsBookId: 100,
  workId: 1000,
  title: "The Hobbit",
  authors: ["J.R.R. Tolkien"],
  publicationYear: 1937,
  language: "eng",
  averageRating: 4.26,
  ratingsCount: 1000000,
  tags: ["fantasy", "adventure", "magic", "dragons"],
};

describe("buildBookDocument", () => {
  it("renders pageContent from only fields present in the dataset", () => {
    const doc = buildBookDocument(book);
    expect(doc.pageContent).toContain("Title: The Hobbit");
    expect(doc.pageContent).toContain("Author: J.R.R. Tolkien");
    expect(doc.pageContent).toContain("Publication Year: 1937");
    expect(doc.pageContent).toContain("Tags: fantasy, adventure, magic, dragons");
    expect(doc.pageContent).toContain("Average Rating: 4.26");
    expect(doc.pageContent).toContain("Ratings Count: 1000000");
  });

  it("omits Tags/Language lines when not present, without inventing values", () => {
    const doc = buildBookDocument({ ...book, tags: [], language: undefined });
    expect(doc.pageContent).not.toContain("Tags:");
    expect(doc.pageContent).not.toContain("Language:");
  });

  it("uses 'Authors' (plural) when there is more than one author", () => {
    const doc = buildBookDocument({ ...book, authors: ["A", "B"] });
    expect(doc.pageContent).toContain("Authors: A, B");
  });

  it("stamps every document with rag/domain ownership metadata", () => {
    const doc = buildBookDocument(book);
    expect(doc.metadata.rag).toBe("book_recommendation");
    expect(doc.metadata.domain).toBe("books");
    expect(doc.metadata.source).toBe("goodbooks-10k");
    expect(doc.metadata.documentType).toBe("book");
    expect(doc.metadata.bookId).toBe(1);
  });

  it("uses null (not undefined) for absent optional metadata fields", () => {
    const doc = buildBookDocument({ ...book, publicationYear: undefined, language: undefined });
    expect(doc.metadata.publicationYear).toBeNull();
    expect(doc.metadata.language).toBeNull();
  });
});
