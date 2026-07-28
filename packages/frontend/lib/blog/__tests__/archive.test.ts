import { describe, it, expect } from "vitest";
import type { BlogPost } from "../types";
import {
  buildArchiveTree,
  filterPostsByMonth,
  buildStateIndex,
  filterPostsByStateSlug,
  monthName,
  NATIONAL_SLUG,
} from "../archive";

function makePost(slug: string, date: string, states: string[]): BlogPost {
  return {
    slug,
    frontmatter: {
      title: slug,
      description: "",
      date,
      author: "PropertyIQ Research",
      category: "market-analysis",
      tags: [],
      states,
      targetKeyword: "",
    },
    content: "",
    readingTime: "1 min read",
  };
}

// getAllPosts() returns newest-first; fixtures mirror that ordering.
const POSTS: BlogPost[] = [
  makePost("july-national", "2026-07-20", []),
  makePost("july-idaho", "2026-07-10", ["ID"]),
  makePost("april-ohio", "2026-04-11", ["OH"]),
  makePost("april-pa-oh", "2026-04-05", ["PA", "OH"]),
  makePost("dec-25-nc", "2025-12-31", ["NC"]),
];

describe("monthName", () => {
  it("maps zero-padded month strings to English names", () => {
    expect(monthName("01")).toBe("January");
    expect(monthName("12")).toBe("December");
  });
});

describe("buildArchiveTree", () => {
  it("groups newest-first by year then month with counts", () => {
    expect(buildArchiveTree(POSTS)).toEqual([
      {
        year: "2026",
        count: 4,
        months: [
          { month: "07", name: "July", count: 2 },
          { month: "04", name: "April", count: 2 },
        ],
      },
      {
        year: "2025",
        count: 1,
        months: [{ month: "12", name: "December", count: 1 }],
      },
    ]);
  });

  it("returns [] for no posts", () => {
    expect(buildArchiveTree([])).toEqual([]);
  });
});

describe("filterPostsByMonth", () => {
  it("returns only posts in that year+month, preserving order", () => {
    const result = filterPostsByMonth(POSTS, "2026", "04");
    expect(result.map((p) => p.slug)).toEqual(["april-ohio", "april-pa-oh"]);
  });

  it("returns [] for a month with no posts", () => {
    expect(filterPostsByMonth(POSTS, "2026", "01")).toEqual([]);
  });
});

describe("buildStateIndex", () => {
  it("counts posts per state A-Z and counts national posts", () => {
    expect(buildStateIndex(POSTS)).toEqual({
      states: [
        { abbrev: "ID", slug: "idaho", name: "Idaho", count: 1 },
        {
          abbrev: "NC",
          slug: "north-carolina",
          name: "North Carolina",
          count: 1,
        },
        { abbrev: "OH", slug: "ohio", name: "Ohio", count: 2 },
        { abbrev: "PA", slug: "pennsylvania", name: "Pennsylvania", count: 1 },
      ],
      nationalCount: 1,
    });
  });
});

describe("filterPostsByStateSlug", () => {
  it("matches by state slug, including multi-state posts", () => {
    const result = filterPostsByStateSlug(POSTS, "ohio");
    expect(result.map((p) => p.slug)).toEqual(["april-ohio", "april-pa-oh"]);
  });

  it("reserves 'national' for empty-states posts", () => {
    const result = filterPostsByStateSlug(POSTS, NATIONAL_SLUG);
    expect(result.map((p) => p.slug)).toEqual(["july-national"]);
  });

  it("returns [] for an unknown slug", () => {
    expect(filterPostsByStateSlug(POSTS, "atlantis")).toEqual([]);
  });
});
