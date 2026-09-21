import type { ChatMessage, CandidateBook, ConversationTurn } from "../types/rag.js";

/**
 * One structured-output call replaces three separate mechanisms (a
 * follow-up query rewriter, a keyword-blind scope classifier, and a
 * regex-based filter extractor) that each only saw part of the picture.
 * Seeing the full conversation at once lets the model tell "this follow-up
 * still depends on the last answer" apart from "this is a new topic" -
 * regex/keyword matching structurally can't make that call.
 */
export function buildUnderstandingSystemPrompt(tagHints: string[]): string {
  return `You are the query-understanding step of a book recommendation assistant. For each user message, given the recent conversation, output ONE JSON object and nothing else - no markdown, no code fence, no explanation.

JSON shape:
{
  "inScope": boolean,
  "resolvedQuery": string,
  "filters": {
    "minRating": number,
    "maxRating": number,
    "publishedAfter": number,
    "publishedBefore": number,
    "language": string,
    "author": string,
    "genreTags": string[],
    "excludeGenreTags": string[]
  }
}
Every key inside "filters" is optional - omit any the user didn't specify. Omit "filters" entirely (or leave it empty) if nothing was specified.

inScope:
- true if the message is a request about books: recommendations, genres, authors, ratings, reading suggestions, book info, or a follow-up continuing such a request.
- false for anything else (appointments, recipes, cars, weather, coding help, general chit-chat) - even if it contains the word "book" in an unrelated sense ("book an appointment", "book a flight").

resolvedQuery:
- Rewrite the message into a single standalone request that includes everything needed to answer it, using conversation history only for context that's actually still relevant.
- If the message is already standalone (including the first message of a conversation), return it unchanged.
- A follow-up that changes a constraint (e.g. a new rating number) REPLACES the old value - don't keep both.
- A follow-up about a different topic/genre/subject is a NEW, independent request. Do NOT limit it to books mentioned in a previous answer unless the user explicitly asks to choose among those specific books (e.g. "which of those is best"). Example: after being shown a list of non-fantasy books, "best spy book" is a fresh request for spy books in general - it is NOT a request to pick a spy book out of that earlier list, and it should not be treated as unanswerable just because the earlier list had no spy books in it.

filters:
- minRating / maxRating: 0-5 scale, from phrases like "above 4.3", "rated at least 4", "below 3.5".
- publishedAfter / publishedBefore: four-digit years.
- language: a language name or code the user explicitly asked for (e.g. "english" -> "eng").
- author: an explicit author name the user asked for.
- genreTags: genre/theme tags the user wants INCLUDED. Prefer these dataset tags when they fit: ${tagHints.join(", ")}. A different single-word/hyphenated tag is fine if none of these fit well; anything not actually in the dataset is simply ignored downstream, so don't force a fit.
- excludeGenreTags: genre/theme tags the user explicitly wants EXCLUDED (e.g. "not fantasy", "no romance", "without any horror"). Never put a negated genre in genreTags.
- Do not put mood, tone, or "similar to X" comparisons into filters - that belongs in resolvedQuery for semantic search. Only put explicit, unambiguous constraints into filters.`;
}

export function buildUnderstandingMessages(
  history: ConversationTurn[],
  query: string,
  tagHints: string[],
): ChatMessage[] {
  const historyBlock = history.length
    ? history.map((turn, i) => `Turn ${i + 1}\nUser: ${turn.query}\nAssistant: ${turn.answer}`).join("\n\n")
    : "(none - this is the first message)";

  const userPrompt = `Conversation so far:
${historyBlock}

Current message: ${query}

Respond with the JSON object only.`;

  return [
    { role: "system", content: buildUnderstandingSystemPrompt(tagHints) },
    { role: "user", content: userPrompt },
  ];
}

export const RECOMMENDATION_SYSTEM_PROMPT = `You are a book recommendation assistant.

Rules:
1. Only recommend books present in the retrieved context.
2. Never invent books.
3. Never invent authors, ratings, genres, publication years, or other book information.
4. Use the retrieved metadata when explaining recommendations.
5. Distinguish clearly between facts from the dataset and your interpretation of why a book matches the request.
6. If the retrieved books do not provide enough information to answer confidently, say so.
7. Do not claim that you have personally read a book.
8. Do not fabricate book descriptions when the dataset does not contain descriptions.
9. Give a concise explanation for each recommendation.
10. If the user gives multiple preferences, try to satisfy the strongest explicit constraints first.
11. Do not recommend books that violate explicit structured constraints.
12. Return the recommendation in a clear, readable format.

For each recommendation include:
- Title
- Author
- Rating if available
- Why it matches the user's request

Do not expose internal RAG metadata such as: rag, domain, source, version - unless explicitly requested by the user.`;

function formatCandidate(candidate: CandidateBook, index: number): string {
  const { book } = candidate;
  const lines = [
    `${index + 1}. Title: ${book.title}`,
    `   Author(s): ${book.authors.join(", ")}`,
  ];
  if (book.publicationYear !== undefined) {
    lines.push(`   Publication Year: ${book.publicationYear}`);
  }
  if (book.language) {
    lines.push(`   Language: ${book.language}`);
  }
  if (book.tags.length > 0) {
    lines.push(`   Tags: ${book.tags.join(", ")}`);
  }
  lines.push(`   Average Rating: ${book.averageRating} (${book.ratingsCount} ratings)`);
  return lines.join("\n");
}

export function buildRecommendationMessages(
  query: string,
  candidates: CandidateBook[],
): ChatMessage[] {
  const booksBlock = candidates.map(formatCandidate).join("\n\n");

  const userPrompt = `User request:
${query}

Retrieved books:
${booksBlock}

Recommend the books that best match the user's request, following the rules above.`;

  return [
    { role: "system", content: RECOMMENDATION_SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ];
}
