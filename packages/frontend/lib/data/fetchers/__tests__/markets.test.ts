import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchPeers } from "../markets";

describe("fetchPeers", () => {
  beforeEach(() => {
    global.fetch = vi.fn() as unknown as typeof fetch;
  });

  it("calls /api/markets/peers/:level/:id and returns parsed JSON", async () => {
    const mockResponse = {
      source: {
        geoLevel: "metro",
        geoId: "39580",
        name: "Charlotte",
        score: 65,
      },
      peers: [
        {
          geoLevel: "metro" as const,
          geoId: "16740",
          name: "Charlotte-Concord",
          score: 64,
          householdCount: 100000,
        },
      ],
    };
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      {
        ok: true,
        json: async () => mockResponse,
      },
    );
    const result = await fetchPeers("metro", "39580");
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/markets\/peers\/metro\/39580$/),
    );
    expect(result).toEqual(mockResponse);
  });

  it("throws on non-ok response", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      {
        ok: false,
        status: 500,
      },
    );
    await expect(fetchPeers("metro", "39580")).rejects.toThrow(/500/);
  });
});
