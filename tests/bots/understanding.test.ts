import { describe, expect, it, vi } from "vitest";
import { parseUnderstandingResponse } from "../../src/bots/book/understanding.js";

describe("parseUnderstandingResponse", () => {
  it("parses a well-formed response", () => {
    const raw = JSON.stringify({
      inScope: true,
      resolvedQuery: "fantasy books rated above 4.3",
      filters: { minRating: 4.3, genreTags: ["fantasy"] },
    });
    const result = parseUnderstandingResponse(raw, "fallback");
    expect(result).toEqual({
      inScope: true,
      resolvedQuery: "fantasy books rated above 4.3",
      filters: { minRating: 4.3, genreTags: ["fantasy"], excludeGenreTags: undefined },
    });
  });

  it("strips a markdown code fence some models wrap JSON in", () => {
    const raw = "```json\n" + JSON.stringify({ inScope: true, resolvedQuery: "q" }) + "\n```";
    const result = parseUnderstandingResponse(raw, "fallback");
    expect(result.inScope).toBe(true);
    expect(result.resolvedQuery).toBe("q");
  });

  it("routes an excluded genre to excludeGenreTags", () => {
    const raw = JSON.stringify({
      inScope: true,
      resolvedQuery: "a popular book that isn't fantasy",
      filters: { excludeGenreTags: ["fantasy"] },
    });
    const result = parseUnderstandingResponse(raw, "fallback");
    expect(result.filters.excludeGenreTags).toEqual(["fantasy"]);
    expect(result.filters.genreTags).toBeUndefined();
  });

  it("does not treat a follow-up as scoped to a previous book list unless the model says so", () => {
    // This only verifies the parser passes through whatever the model
    // decided - the "don't over-anchor to the last list" judgment call
    // itself lives in the prompt (see llm/prompts.ts), not in this parser.
    const raw = JSON.stringify({
      inScope: true,
      resolvedQuery: "recommend a popular spy book",
      filters: { genreTags: ["spy"] },
    });
    const result = parseUnderstandingResponse(raw, "best spy book");
    expect(result.resolvedQuery).toBe("recommend a popular spy book");
    expect(result.filters.genreTags).toEqual(["spy"]);
  });

  it("drops a genre tag that isn't in the dataset's vocabulary, keeping other filters", () => {
    const raw = JSON.stringify({
      inScope: true,
      resolvedQuery: "q",
      filters: { minRating: 4, genreTags: ["fantasy", "not-a-real-tag"] },
    });
    const validTags = new Set(["fantasy", "romance"]);
    const result = parseUnderstandingResponse(raw, "fallback", validTags);
    expect(result.filters.genreTags).toEqual(["fantasy"]);
    expect(result.filters.minRating).toBe(4);
  });

  it("drops the whole genreTags array if none of the tags are valid", () => {
    const raw = JSON.stringify({
      inScope: true,
      resolvedQuery: "q",
      filters: { genreTags: ["not-a-real-tag"] },
    });
    const result = parseUnderstandingResponse(raw, "fallback", new Set(["fantasy"]));
    expect(result.filters.genreTags).toBeUndefined();
  });

  it("trusts tags as-is when no vocabulary is available (e.g. dataset file unreadable)", () => {
    const raw = JSON.stringify({
      inScope: true,
      resolvedQuery: "q",
      filters: { genreTags: ["whatever-the-model-said"] },
    });
    const result = parseUnderstandingResponse(raw, "fallback", undefined);
    expect(result.filters.genreTags).toEqual(["whatever-the-model-said"]);
  });

  it("falls back to unfiltered semantic search on unparseable JSON", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = parseUnderstandingResponse("not json at all", "the original query");
    expect(result).toEqual({ inScope: true, resolvedQuery: "the original query", filters: {} });
    warn.mockRestore();
  });

  it("falls back to unfiltered semantic search when the shape doesn't match the schema", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const raw = JSON.stringify({ someUnexpectedShape: true });
    const result = parseUnderstandingResponse(raw, "the original query");
    expect(result).toEqual({ inScope: true, resolvedQuery: "the original query", filters: {} });
    warn.mockRestore();
  });

  it("falls back to the original query if resolvedQuery is empty", () => {
    const raw = JSON.stringify({ inScope: true, resolvedQuery: "" });
    const result = parseUnderstandingResponse(raw, "original");
    expect(result.resolvedQuery).toBe("original");
  });
});
