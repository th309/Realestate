import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchMarketContext } from "../analyzer";

afterEach(() => vi.restoreAllMocks());

describe("fetchMarketContext error semantics", () => {
  it("returns the payload on 200", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ geo_level: "zip", market_heat: { value: 66.9 } }),
    } as Response);
    const r = await fetchMarketContext({ zip: "21701" });
    expect((r as { geo_level: string }).geo_level).toBe("zip");
  });

  it("returns { quotaExceeded: true } on 402", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 402,
    } as Response);
    await expect(fetchMarketContext({ zip: "21701" })).resolves.toEqual({
      quotaExceeded: true,
    });
  });

  it("throws on 5xx so React Query can retry / self-heal", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 503,
    } as Response);
    await expect(fetchMarketContext({ zip: "21701" })).rejects.toThrow(/503/);
  });

  it("stays fail-soft null on 4xx (auth, unknown geo)", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);
    await expect(fetchMarketContext({ zip: "00000" })).resolves.toBeNull();
  });
});
