import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchAiInsight } from "../ai-insights";

afterEach(() => vi.restoreAllMocks());

describe("fetchAiInsight", () => {
  it("POSTs to /ai-insights/section with payload + id", async () => {
    const mockFetch = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        text: "Strong cashflow play.",
        threadId: "t1",
        citedFacts: [],
        cacheHit: false,
      }),
    } as Response);

    const r = await fetchAiInsight({
      id: "projection",
      payload: { input: { price: 240000 }, result: {}, rentcast: {}, piq: {} },
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/analyzer/ai-insights/section"),
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: expect.stringContaining('"id":"projection"'),
      }),
    );
    expect(r.text).toBe("Strong cashflow play.");
  });

  it("throws on non-2xx", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);
    await expect(
      fetchAiInsight({
        id: "projection",
        payload: { input: {}, result: {}, rentcast: {}, piq: {} },
      }),
    ).rejects.toThrow(/500/);
  });
});
