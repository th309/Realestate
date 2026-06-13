import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.mock("../base", () => ({
  API_URL: "http://test",
  fetchAPIWithParams: (...a: unknown[]) => mockFetch(...a),
  fetchAPI: (...a: unknown[]) => mockFetch(...a),
}));

import { fetchRankings } from "../rankings";

describe("fetchRankings", () => {
  beforeEach(() => mockFetch.mockReset());

  it("maps the rankings response to flat RankingRow[]", async () => {
    mockFetch.mockResolvedValue({
      score_type: "propertyiq",
      geography_level: "metro",
      score_date: "2026-04-30",
      rankings: [
        {
          rank: 1,
          geography: { id: "12420", name: "Austin, TX" },
          score: 88,
          grade: "A",
          confidence: { level: "A", percentage: 100 },
        },
        {
          rank: 2,
          geography: { id: "26420", name: "Houston, TX" },
          score: 71,
          grade: "B",
          confidence: { level: "B", percentage: 75 },
        },
      ],
      count: 2,
    });
    const rows = await fetchRankings("propertyiq", "metro", {
      state: "TX",
      limit: 10,
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      rank: 1,
      id: "12420",
      name: "Austin, TX",
      score: 88,
      grade: "A",
    });
  });

  it("returns [] on a malformed or empty response (graceful degradation)", async () => {
    mockFetch.mockResolvedValue({}); // no `rankings` field
    await expect(
      fetchRankings("propertyiq", "county", { state: "TX" }),
    ).resolves.toEqual([]);
  });
});
