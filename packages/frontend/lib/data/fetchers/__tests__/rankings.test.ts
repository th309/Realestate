import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.mock("../base", () => ({
  API_URL: "http://test",
  fetchAPIWithParams: (...a: unknown[]) => mockFetch(...a),
  fetchAPICached: (...a: unknown[]) => mockFetch(...a),
  fetchAPI: (...a: unknown[]) => mockFetch(...a),
}));

import { fetchRankings } from "../rankings";

describe("fetchRankings", () => {
  beforeEach(() => mockFetch.mockReset());

  it("maps the public /api/scores/top flat array to ranked RankingRow[]", async () => {
    // /api/scores/top returns a flat array of {location_id, location_name, score, grade}
    mockFetch.mockResolvedValue([
      {
        location_id: "12420",
        location_name: "Austin, TX",
        score: 88,
        grade: "A",
      },
      {
        location_id: "26420",
        location_name: "Houston, TX",
        score: 71,
        grade: "B",
      },
    ]);
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
    expect(rows[1].rank).toBe(2);
    // hits the public endpoint, not the gated /api/v1/rankings
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/scores/top",
      expect.objectContaining({
        geography: "metro",
        score_type: "propertyiq",
        state: "TX",
      }),
      expect.objectContaining({ revalidate: 86400, tags: ["piq-market-data"] }),
    );
  });

  it("returns [] on a malformed or empty response (graceful degradation)", async () => {
    mockFetch.mockResolvedValue({}); // not an array
    await expect(
      fetchRankings("propertyiq", "county", { state: "TX" }),
    ).resolves.toEqual([]);
  });
});
