import type { CandidateBook, Reranker } from "../types/rag.js";

/**
 * v1 has no re-ranking model. This identity implementation exists purely
 * so the retrieval pipeline already has a re-ranking seam - swap this for
 * a real Reranker (e.g. backed by Voyage's rerank endpoint) later without
 * touching callers.
 */
export class NoopReranker implements Reranker {
  async rerank(_query: string, candidates: CandidateBook[], topN: number): Promise<CandidateBook[]> {
    return candidates.slice(0, topN);
  }
}

export function getReranker(): Reranker {
  return new NoopReranker();
}
