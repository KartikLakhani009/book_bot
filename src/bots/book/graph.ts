import { Annotation, END, MemorySaver, START, StateGraph } from "@langchain/langgraph";
import type { CandidateBook, ConversationTurn } from "../../types/rag.js";
import type { BookFilters } from "./state.js";
import {
  filterBooksNode,
  generateRecommendationNode,
  retrieveBooksNode,
  understandNode,
} from "./nodes.js";

/** Bound how much conversation state a single thread accumulates. */
const MAX_HISTORY_TURNS = 10;

const BookBotAnnotation = Annotation.Root({
  query: Annotation<string>,
  inScope: Annotation<boolean | undefined>,
  history: Annotation<ConversationTurn[]>({
    reducer: (prev, next) => [...prev, ...next].slice(-MAX_HISTORY_TURNS),
    default: () => [],
  }),
  resolvedQuery: Annotation<string | undefined>,
  filters: Annotation<BookFilters | undefined>,
  retrievedBooks: Annotation<CandidateBook[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  finalAnswer: Annotation<string | undefined>,
});

/**
 * START -> understand -+-> (out of scope) -> END
 *                        \-> retrieveBooks -> filterBooks
 *                           -> generateRecommendation -> END
 *
 * understand is one structured-output LLM call that resolves follow-ups
 * ("what about 4.24") against `history` (persisted per `thread_id` by the
 * MemorySaver checkpointer - see runBookBot), checks whether the resolved
 * request is book-related, and extracts structured filters, all from one
 * shared view of the conversation (see nodes.ts for why that matters more
 * than three separate passes over less context). It sets finalAnswer
 * itself for the out-of-scope path, which skips straight to END.
 *
 * State is intentionally minimal for v1. Future additions (rerankedBooks,
 * feedback, userPreferences) each get their own channel here without
 * touching existing nodes.
 */
function compileBookBotGraph() {
  return new StateGraph(BookBotAnnotation)
    .addNode("understand", understandNode)
    .addNode("retrieveBooks", retrieveBooksNode)
    .addNode("filterBooks", filterBooksNode)
    .addNode("generateRecommendation", generateRecommendationNode)
    .addEdge(START, "understand")
    .addConditionalEdges("understand", (state) => (state.inScope === false ? END : "retrieveBooks"))
    .addEdge("retrieveBooks", "filterBooks")
    .addEdge("filterBooks", "generateRecommendation")
    .addEdge("generateRecommendation", END)
    .compile({ checkpointer: new MemorySaver() });
}

type CompiledBookBotGraph = ReturnType<typeof compileBookBotGraph>;
let cachedGraph: CompiledBookBotGraph | undefined;

/** The graph is stateless once compiled, so build it once and reuse it. */
export function buildBookBotGraph(): CompiledBookBotGraph {
  if (!cachedGraph) {
    cachedGraph = compileBookBotGraph();
  }
  return cachedGraph;
}

/**
 * `threadId` scopes conversation memory (MemorySaver keys state by it).
 * Reuse the same id across turns for a given conversation/session; a new
 * id starts a fresh conversation with empty history.
 */
export async function runBookBot(query: string, threadId = "default") {
  const app = buildBookBotGraph();
  return app.invoke({ query }, { configurable: { thread_id: threadId } });
}
