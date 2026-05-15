import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchPropertyLookup } from "../property-lookup";

afterEach(() => vi.restoreAllMocks());

describe("fetchPropertyLookup", () => {
  it("GET /api/analyzer/property-lookup with address query", async () => {
    const mockFetch = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        avm: { value: 245000, low: 230000, high: 260000, comps_count: 5 },
        rent: null,
        property_record: null,
        sales_comps: [],
        rental_comps: [],
        cache_age_days: 0,
        source: "rentcast",
      }),
    } as Response);
    const r = await fetchPropertyLookup({ address: "123 Main" });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(
        "/api/analyzer/property-lookup?address=123%20Main",
      ),
      expect.objectContaining({ credentials: "include" }),
    );
    expect((r as { avm: { value: number } }).avm?.value).toBe(245000);
  });

  it("returns { quotaExceeded: true } on 429", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 429,
    } as Response);
    const r = await fetchPropertyLookup({ address: "X" });
    expect(r).toEqual({ quotaExceeded: true });
  });

  it("throws on non-429 error", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);
    await expect(fetchPropertyLookup({ address: "X" })).rejects.toThrow(/500/);
  });
});
