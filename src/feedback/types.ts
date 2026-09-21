/**
 * Future feedback schema (see project constraints: not wired into the
 * pipeline yet). Kept separate from the authoritative dataset so user
 * feedback never mutates `book_documents` directly.
 */
export interface BookRecommendationFeedback {
  query: string;

  recommendedBookIds: number[];

  selectedBookId?: number;

  feedbackType: "positive" | "negative" | "neutral";

  feedbackText?: string;

  source: "user";

  createdAt: string;
}
