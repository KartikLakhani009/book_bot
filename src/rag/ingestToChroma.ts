import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Collection } from "chromadb";
import type { CleanBook } from "../types/book.js";
import { buildBookDocuments } from "./documents.js";
import { EMBEDDING_BATCH_SIZE, getEmbeddingProvider } from "./embeddings.js";
import { getBookCollection } from "./chroma.js";

const INPUT_PATH = resolve(process.cwd(), "data/processed/books.cleaned.json");
const FORCE = process.argv.includes("--force");
const PAGE_SIZE = 1000;

function bookDocId(book: CleanBook): string {
  return `book-${book.bookId}`;
}

/** Paginates through the collection's ids (cheap - local Chroma, no Voyage/Groq cost). */
async function fetchExistingIds(collection: Collection): Promise<Set<string>> {
  const ids = new Set<string>();
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await collection.get({ limit: PAGE_SIZE, offset, include: [] });
    for (const id of page.ids) ids.add(id);
    if (page.ids.length < PAGE_SIZE) break;
  }
  return ids;
}

async function main() {
  console.log("[CHROMA] Reading cleaned dataset from", INPUT_PATH);
  const raw = await readFile(INPUT_PATH, "utf-8");
  const allBooks: CleanBook[] = JSON.parse(raw);
  console.log(`[CHROMA] Books in cleaned dataset: ${allBooks.length}`);

  const collection = await getBookCollection();

  let books = allBooks;
  if (!FORCE) {
    const existingIds = await fetchExistingIds(collection);
    if (existingIds.size >= allBooks.length) {
      console.log(
        `[CHROMA] Collection "${collection.name}" already has ${existingIds.size} documents ` +
          `(>= the ${allBooks.length} in the cleaned dataset). Skipping embedding/storage. ` +
          `Pass --force to re-embed everything.`,
      );
      return;
    }
    books = allBooks.filter((book) => !existingIds.has(bookDocId(book)));
    if (existingIds.size > 0) {
      console.log(
        `[CHROMA] Resuming: ${existingIds.size} documents already stored, ${books.length} remaining.`,
      );
    }
  }

  const documents = buildBookDocuments(books);
  const embeddingProvider = getEmbeddingProvider();

  let stored = 0;
  for (let i = 0; i < documents.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = documents.slice(i, i + EMBEDDING_BATCH_SIZE);
    const bookBatch = books.slice(i, i + EMBEDDING_BATCH_SIZE);

    console.log(
      `[EMBEDDING] Embedding documents ${i + 1}-${i + batch.length} of ${documents.length}...`,
    );
    const embeddings = await embeddingProvider.embedDocuments(
      batch.map((doc) => doc.pageContent),
    );

    // upsert (not add) so a re-run after a rate-limit/crash is safe to resume.
    await collection.upsert({
      ids: bookBatch.map(bookDocId),
      embeddings,
      documents: batch.map((doc) => doc.pageContent),
      metadatas: batch.map((doc) => doc.metadata),
    });

    stored += batch.length;
    console.log(`[CHROMA] Documents stored this run: ${stored}/${documents.length}`);
  }

  console.log(`[CHROMA] Done. Collection "${collection.name}" now has ${await collection.count()} book documents.`);
}

main().catch((err) => {
  console.error("[CHROMA] Fatal error:", err);
  process.exitCode = 1;
});
