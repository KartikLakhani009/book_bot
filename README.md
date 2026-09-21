# Book Recommendation RAG Bot

TypeScript + LangGraph + Groq + Voyage AI + ChromaDB, over the
[Goodbooks-10k](https://github.com/zygmuntz/goodbooks-10k) dataset.

## Setup

1. `npm install`
2. Fill in `.env` (already copied from `.env.example`) with real
   `GROQ_API_KEY` and `VOYAGE_API_KEY` values.
3. Start the local Chroma server (native binary shipped by the `chromadb`
   npm package - no Docker/Python required):
   ```
   npm run chroma:start
   ```
   Leave this running in its own terminal.
4. In another terminal, build the cleaned dataset from the raw CSVs:
   ```
   npm run ingest:build-dataset
   ```
5. Embed and store it in Chroma:
   ```
   npm run ingest:store
   ```
6. Query the bot:
   ```
   npm run dev
   ```

## Scripts

| Script | What it does |
| --- | --- |
| `chroma:start` | Runs a local persistent Chroma server on `localhost:8000` |
| `ingest:build-dataset` | CSVs -> clean, joined `data/processed/books.cleaned.json` |
| `ingest:store` | Embeds cleaned books (Voyage) and stores them in Chroma |
| `dev` | Interactive CLI to query the bot |
| `test` | Unit tests (vitest) |
| `typecheck` | `tsc --noEmit` |

Both `ingest:*` scripts are safe to re-run and skip work that's already
done:

- `ingest:build-dataset` skips the CSV parse/clean entirely if
  `data/processed/books.cleaned.json` already exists.
- `ingest:store` checks how many documents are already in the Chroma
  collection and only embeds the books still missing (or skips entirely if
  the collection is already fully populated) - important on a rate-limited
  free API plan, since every book only gets embedded once.

Pass `--force` to either one to rebuild/re-embed from scratch, e.g.
`npm run ingest:store -- --force`.

## Swapping the embedding model or LLM

Both are env-driven and go through a small interface so the rest of the
app never depends on a specific vendor:

- `src/types/rag.ts` - `EmbeddingProvider` / `ChatModel` interfaces
- `src/rag/embeddings.ts` - `VoyageEmbeddingProvider` (swap the model via
  `VOYAGE_EMBEDDING_MODEL`, or add a new class implementing
  `EmbeddingProvider` and change `getEmbeddingProvider()`)
- `src/llm/model.ts` - `GroqChatModel` (swap the model via `GROQ_MODEL`,
  or add a new class implementing `ChatModel` and change `getChatModel()`)

If you switch to a different embedding model/provider, re-run
`ingest:store` against a fresh collection (vectors from different models
aren't comparable).

## Architecture notes

- Retrieval is metadata-scoped to `rag: "book_recommendation"` so this
  bot's documents stay isolated even if the Chroma instance is later
  shared with other domain bots.
- The LLM only explains/ranks books already retrieved - it never
  originates book facts. See `src/llm/prompts.ts`.
- Re-ranking (`src/rag/reranker.ts`) and feedback
  (`src/feedback/types.ts`) are stubbed/typed for a later phase, not wired
  into the pipeline yet.
- Graph: `understand` (one structured-output Groq call - resolves
  follow-ups against conversation history, scope-checks the resolved
  request, extracts structured filters) -> `retrieveBooks` -> `filterBooks`
  -> `generateRecommendation`. See `src/bots/book/nodes.ts` and
  `src/bots/book/understanding.ts` (the pure, unit-tested response
  parser/validator). Conversation memory is a LangGraph `MemorySaver`
  checkpointer keyed by `thread_id`, not manually threaded state.
- Structured filters are extracted by the LLM rather than regex, because
  natural-language phrasing (negation, filler words, topic shifts across
  turns) kept finding new edge cases regex couldn't cover. Genre tags the
  model returns are validated against the dataset's real tag vocabulary
  (`src/bots/book/tagVocabulary.ts`) and silently dropped if invalid,
  never left to filter on a tag that can't exist in Chroma.
