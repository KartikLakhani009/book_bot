import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { loadBookTagsCsv, loadBooksCsv, loadTagsCsv } from "./loadBooks.js";
import { buildTagsByGoodreadsBookId } from "./loadTags.js";
import { mergeBookData } from "./mergeBookData.js";

const RAW_DIR = resolve(process.cwd(), "data/raw/goodbooks-10k");
const OUTPUT_PATH = resolve(process.cwd(), "data/processed/books.cleaned.json");
const FORCE = process.argv.includes("--force");

async function main() {
  const existing = await stat(OUTPUT_PATH).catch(() => undefined);
  if (existing && !FORCE) {
    console.log(
      `[CLEANING] ${OUTPUT_PATH} already exists (last built ${existing.mtime.toISOString()}). ` +
        `Skipping CSV re-parse/clean. Pass --force to rebuild it.`,
    );
    return;
  }

  console.log("[INGESTION] Loading CSVs from", RAW_DIR);
  const [rawBooks, rawTags, rawBookTags] = await Promise.all([
    loadBooksCsv(resolve(RAW_DIR, "books.csv")),
    loadTagsCsv(resolve(RAW_DIR, "tags.csv")),
    loadBookTagsCsv(resolve(RAW_DIR, "book_tags.csv")),
  ]);
  console.log(`[INGESTION] Books loaded: ${rawBooks.length}`);
  console.log(`[INGESTION] Tags loaded: ${rawTags.length}`);
  console.log(`[INGESTION] Book-tag links loaded: ${rawBookTags.length}`);

  const tagsByGoodreadsBookId = buildTagsByGoodreadsBookId(rawTags, rawBookTags);
  console.log(`[INGESTION] Books with resolved tags: ${tagsByGoodreadsBookId.size}`);

  const { books, rejections, duplicateBookIds } = mergeBookData(rawBooks, tagsByGoodreadsBookId);

  console.log("[CLEANING]");
  console.log(`Valid books: ${books.length}`);
  console.log(`Invalid books: ${rejections.length}`);
  console.log(`Duplicate book_ids dropped: ${duplicateBookIds.length}`);
  if (rejections.length > 0) {
    const reasonCounts = new Map<string, number>();
    for (const r of rejections) {
      reasonCounts.set(r.reason, (reasonCounts.get(r.reason) ?? 0) + 1);
    }
    for (const [reason, count] of reasonCounts) {
      console.log(`  - ${reason}: ${count}`);
    }
  }

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(books, null, 2), "utf-8");
  console.log(`[CLEANING] Wrote ${books.length} clean books to ${OUTPUT_PATH}`);

  console.log("\n[CLEANING] Sample records:");
  for (const sample of books.slice(0, 3)) {
    console.log(JSON.stringify(sample, null, 2));
  }
}

main().catch((err) => {
  console.error("[INGESTION] Fatal error:", err);
  process.exitCode = 1;
});
