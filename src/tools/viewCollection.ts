import { createServer } from "node:http";
import { getBookCollection } from "../rag/chroma.js";
import type { BookDocumentMetadata } from "../types/rag.js";

const PORT = 4500;
const PAGE_SIZE = 1000;

/**
 * Dev-only local viewer for the book_documents collection - built after
 * every third-party ChromaDB GUI we tried (chroma CLI's `browse` TUI,
 * chromadb-admin) turned out broken or crashed in practice. This talks to
 * Chroma the same way the bot itself does (getBookCollection), so if the
 * bot works this works. Loads all metadata once (no embeddings/documents -
 * keeps the payload small) and serves a single static page with a
 * client-side searchable/sortable table.
 */
async function fetchAllMetadata(): Promise<BookDocumentMetadata[]> {
  const collection = await getBookCollection();
  const rows: BookDocumentMetadata[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await collection.get<BookDocumentMetadata>({
      limit: PAGE_SIZE,
      offset,
      include: ["metadatas"],
    });
    for (const metadata of page.metadatas) {
      if (metadata) rows.push(metadata);
    }
    if (page.ids.length < PAGE_SIZE) break;
  }

  return rows;
}

function renderPage(rows: BookDocumentMetadata[]): string {
  const data = JSON.stringify(rows).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>book_documents viewer</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: -apple-system, system-ui, sans-serif; margin: 0; padding: 1.5rem; }
  h1 { font-size: 1.1rem; margin: 0 0 0.25rem; }
  #meta { color: #888; margin-bottom: 1rem; font-size: 0.85rem; }
  #search { width: 100%; max-width: 420px; padding: 0.5rem 0.75rem; font-size: 0.95rem;
    border: 1px solid #ccc; border-radius: 6px; margin-bottom: 1rem; box-sizing: border-box; }
  table { border-collapse: collapse; width: 100%; font-size: 0.88rem; }
  th, td { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid #e5e5e5; vertical-align: top; }
  th { position: sticky; top: 0; background: Canvas; cursor: pointer; user-select: none; white-space: nowrap; }
  th:hover { color: #0969da; }
  td.tags { color: #666; max-width: 260px; }
  td.rating { text-align: right; white-space: nowrap; }
  tr:hover td { background: rgba(9, 105, 218, 0.06); }
</style>
</head>
<body>
  <h1>book_documents</h1>
  <div id="meta"></div>
  <input id="search" type="text" placeholder="Search title, author, or tag..." />
  <table>
    <thead>
      <tr>
        <th data-key="title">Title</th>
        <th data-key="authors">Author(s)</th>
        <th data-key="averageRating">Rating</th>
        <th data-key="ratingsCount">Ratings</th>
        <th data-key="publicationYear">Year</th>
        <th data-key="language">Lang</th>
        <th data-key="tags">Tags</th>
      </tr>
    </thead>
    <tbody id="rows"></tbody>
  </table>

<script>
  const allRows = ${data};
  const tbody = document.getElementById("rows");
  const metaEl = document.getElementById("meta");
  const searchEl = document.getElementById("search");
  let sortKey = "title";
  let sortDir = 1;

  function render() {
    const q = searchEl.value.trim().toLowerCase();
    let rows = allRows.filter((r) =>
      !q ||
      r.title.toLowerCase().includes(q) ||
      r.authors.join(", ").toLowerCase().includes(q) ||
      r.tags.join(", ").toLowerCase().includes(q),
    );
    rows.sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const cmp = typeof av === "string" ? String(av).localeCompare(String(bv)) : (av ?? 0) - (bv ?? 0);
      return cmp * sortDir;
    });
    metaEl.textContent = rows.length + " of " + allRows.length + " documents";
    tbody.innerHTML = rows
      .map(
        (r) =>
          "<tr>" +
          "<td>" + r.title + "</td>" +
          "<td>" + r.authors.join(", ") + "</td>" +
          "<td class='rating'>" + r.averageRating.toFixed(2) + "</td>" +
          "<td class='rating'>" + r.ratingsCount.toLocaleString() + "</td>" +
          "<td>" + (r.publicationYear ?? "") + "</td>" +
          "<td>" + (r.language ?? "") + "</td>" +
          "<td class='tags'>" + r.tags.join(", ") + "</td>" +
          "</tr>",
      )
      .join("");
  }

  document.querySelectorAll("th[data-key]").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.getAttribute("data-key");
      if (sortKey === key) sortDir *= -1;
      else { sortKey = key; sortDir = 1; }
      render();
    });
  });
  searchEl.addEventListener("input", render);
  render();
</script>
</body>
</html>`;
}

async function main() {
  console.log("[VIEW] Loading metadata from book_documents...");
  const rows = await fetchAllMetadata();
  console.log(`[VIEW] Loaded ${rows.length} documents.`);

  const html = renderPage(rows);

  const server = createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  });

  server.listen(PORT, () => {
    console.log(`[VIEW] Open http://localhost:${PORT} in your browser.`);
    console.log("[VIEW] Ctrl+C to stop.");
  });
}

main().catch((err) => {
  console.error("[VIEW] Fatal error:", err);
  process.exitCode = 1;
});
