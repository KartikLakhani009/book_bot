import { Document } from "@langchain/core/documents";
import type { CleanBook } from "../types/book.js";
import type { BookDocumentMetadata } from "../types/rag.js";

/**
 * Renders the semantic text a book's embedding is computed from. Only
 * fields actually present in the Goodbooks-10k dataset are included - no
 * invented descriptions.
 */
export function buildBookPageContent(book: CleanBook): string {
  const lines: string[] = [
    `Title: ${book.title}`,
    `Author${book.authors.length > 1 ? "s" : ""}: ${book.authors.join(", ")}`,
  ];

  if (book.publicationYear !== undefined) {
    lines.push(`Publication Year: ${book.publicationYear}`);
  }
  if (book.language) {
    lines.push(`Language: ${book.language}`);
  }
  if (book.tags.length > 0) {
    lines.push(`Tags: ${book.tags.join(", ")}`);
  }
  lines.push(`Average Rating: ${book.averageRating}`);
  lines.push(`Ratings Count: ${book.ratingsCount}`);

  return lines.join("\n");
}

export function buildBookMetadata(book: CleanBook): BookDocumentMetadata {
  return {
    rag: "book_recommendation",
    domain: "books",

    source: "goodbooks-10k",
    sourceType: "dataset",
    version: "v1",
    documentType: "book",

    bookId: book.bookId,
    goodreadsBookId: book.goodreadsBookId,
    workId: book.workId,

    title: book.title,
    authors: book.authors,

    publicationYear: book.publicationYear ?? null,
    language: book.language ?? null,

    averageRating: book.averageRating,
    ratingsCount: book.ratingsCount,

    tags: book.tags,
  };
}

export function buildBookDocument(book: CleanBook): Document<BookDocumentMetadata> {
  return new Document({
    pageContent: buildBookPageContent(book),
    metadata: buildBookMetadata(book),
  });
}

export function buildBookDocuments(books: CleanBook[]): Document<BookDocumentMetadata>[] {
  return books.map(buildBookDocument);
}
