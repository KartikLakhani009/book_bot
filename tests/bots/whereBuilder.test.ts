import { describe, expect, it } from "vitest";
import { buildWhereFromFilters, ENGLISH_LANGUAGE_CODES } from "../../src/bots/book/whereBuilder.js";
import type { BookFilters } from "../../src/bots/book/state.js";

describe("buildWhereFromFilters", () => {
  it("returns undefined for no filters", () => {
    expect(buildWhereFromFilters({})).toBeUndefined();
  });

  it("returns a bare single-key clause for exactly one filter, not wrapped in $and", () => {
    // Regression: Chroma rejects a `where` object with more than one
    // top-level key ("Expected 'where' to have exactly one operator") -
    // every clause this function ever returns must respect that, whether
    // or not it needs $and.
    const where = buildWhereFromFilters({ minRating: 4.3 });
    expect(where).toEqual({ averageRating: { $gte: 4.3 } });
  });

  it("wraps two or more filters in $and, each still a single-key clause", () => {
    const where = buildWhereFromFilters({ minRating: 4.3, publishedAfter: 2000 });
    expect(where).toEqual({
      $and: [{ averageRating: { $gte: 4.3 } }, { publicationYear: { $gte: 2000 } }],
    });
  });

  it("maps maxRating / publishedBefore to $lte", () => {
    const where = buildWhereFromFilters({ maxRating: 3.5, publishedBefore: 1950 });
    expect(where).toEqual({
      $and: [{ averageRating: { $lte: 3.5 } }, { publicationYear: { $lte: 1950 } }],
    });
  });

  it("expands language 'eng' to every English dataset code via $in", () => {
    const where = buildWhereFromFilters({ language: "eng" });
    expect(where).toEqual({ language: { $in: ENGLISH_LANGUAGE_CODES } });
  });

  it("uses an exact match for a non-English language code", () => {
    const where = buildWhereFromFilters({ language: "spa" });
    expect(where).toEqual({ language: { $in: ["spa"] } });
  });

  it("maps genreTags to $contains and excludeGenreTags to $not_contains", () => {
    const where = buildWhereFromFilters({
      genreTags: ["fantasy"],
      excludeGenreTags: ["romance"],
    });
    expect(where).toEqual({
      $and: [{ tags: { $contains: "fantasy" } }, { tags: { $not_contains: "romance" } }],
    });
  });

  it("emits one $contains clause per genre tag when there are several", () => {
    const where = buildWhereFromFilters({ genreTags: ["fantasy", "adventure"] });
    expect(where).toEqual({
      $and: [{ tags: { $contains: "fantasy" } }, { tags: { $contains: "adventure" } }],
    });
  });

  it("combines every filter kind into one flat $and list", () => {
    const filters: BookFilters = {
      minRating: 4.3,
      publishedAfter: 2000,
      language: "eng",
      genreTags: ["fantasy"],
      excludeGenreTags: ["romance"],
    };
    const where = buildWhereFromFilters(filters);
    expect(where).toEqual({
      $and: [
        { averageRating: { $gte: 4.3 } },
        { publicationYear: { $gte: 2000 } },
        { language: { $in: ENGLISH_LANGUAGE_CODES } },
        { tags: { $contains: "fantasy" } },
        { tags: { $not_contains: "romance" } },
      ],
    });
  });
});
