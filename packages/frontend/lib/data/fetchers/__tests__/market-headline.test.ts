import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchMarketHeadline } from "../market-headline";

vi.mock("../auth-headers", () => ({
  getAuthHeaders: async () => ({ Authorization: "Bearer test-token" }),
}));

describe("fetchMarketHeadline", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          success: true,
          headline: {
            headline: "Prices firming",
            summary: "Austin is firming.",
            generatedAt: "2026-07-14T00:00:00.000Z",
            cached: false,
          },
        }),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("POSTs to the ai-headline route and unwraps the headline payload", async () => {
    const result = await fetchMarketHeadline("metro", "12420", {
      geoName: "Austin, TX",
      audience: "homebuyer",
      metrics: {
        home_value: { value: 455000, formatted: "$455K", change: 3.1 },
      },
      scores: { propertyiq: { score: 62, grade: "B" } },
    });

    expect(result.headline).toBe("Prices firming");
    expect(result.summary).toBe("Austin is firming.");

    const call = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(call[0])).toContain("/api/markets/metro/12420/ai-headline");
    expect(call[1].method).toBe("POST");
  });

  it("throws when the response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })),
    );
    await expect(
      fetchMarketHeadline("metro", "12420", {
        geoName: "Austin, TX",
        audience: "investor",
        metrics: {},
        scores: { propertyiq: null },
      }),
    ).rejects.toThrow("AI headline request failed: 500");
  });
});
