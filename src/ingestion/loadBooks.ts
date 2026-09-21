import { createReadStream } from "node:fs";
import { parse } from "csv-parse";
import type { RawBookRow, RawTagRow, RawBookTagRow } from "../types/book.js";

async function parseCsv<T>(filePath: string): Promise<T[]> {
  const rows: T[] = [];
  const parser = createReadStream(filePath).pipe(
    parse({ columns: true, skip_empty_lines: true, trim: true }),
  );
  try {
    for await (const record of parser) {
      rows.push(record as T);
    }
  } catch (err) {
    throw new Error(`Failed to parse CSV at ${filePath}: ${(err as Error).message}`);
  }
  return rows;
}

export function loadBooksCsv(filePath: string): Promise<RawBookRow[]> {
  return parseCsv<RawBookRow>(filePath);
}

export function loadTagsCsv(filePath: string): Promise<RawTagRow[]> {
  return parseCsv<RawTagRow>(filePath);
}

export function loadBookTagsCsv(filePath: string): Promise<RawBookTagRow[]> {
  return parseCsv<RawBookTagRow>(filePath);
}
