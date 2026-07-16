import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("../base", () => ({ fetchAPIWithParams: vi.fn() }));
import { fetchAPIWithParams } from "../base";
import { fetchScopeSeries } from "../market-explorer";

describe("fetchScopeSeries", () => {
  beforeEach(() => vi.clearAllMocks());

  it("builds the scope URL and forwards query params without a metric param", async () => {
    (fetchAPIWithParams as any).mockResolvedValue({
      success: true,
      geoLevel: "county",
      months: 120,
      dates: [],
      regions: [],
      series: {},
    });
    await fetchScopeSeries("county", {
      parentLevel: "metro",
      parentId: "19100",
      months: 120,
    });
    expect(fetchAPIWithParams).toHaveBeenCalledWith(
      "/api/market-explorer/scope/county",
      {
        parentLevel: "metro",
        parentId: "19100",
        months: 120,
        includeNearby: undefined,
      },
    );
  });

  it("omits parent params at national scope", async () => {
    (fetchAPIWithParams as any).mockResolvedValue({
      success: true,
      geoLevel: "metro",
      months: 24,
      regions: [],
      series: {},
      dates: [],
    });
    await fetchScopeSeries("metro", { months: 24 });
    expect(fetchAPIWithParams).toHaveBeenCalledWith(
      "/api/market-explorer/scope/metro",
      {
        parentLevel: undefined,
        parentId: undefined,
        months: 24,
        includeNearby: undefined,
      },
    );
  });

  it("forwards includeNearby as the string 'true' when set", async () => {
    (fetchAPIWithParams as any).mockResolvedValue({
      success: true,
      geoLevel: "metro",
      months: 24,
      regions: [],
      series: {},
      dates: [],
    });
    await fetchScopeSeries("metro", {
      parentLevel: "state",
      parentId: "48",
      months: 24,
      includeNearby: true,
    });
    expect(fetchAPIWithParams).toHaveBeenCalledWith(
      "/api/market-explorer/scope/metro",
      {
        parentLevel: "state",
        parentId: "48",
        months: 24,
        includeNearby: "true",
      },
    );
  });

  it("resolves the combined-metric response shape (series nested by metric then region) and totalAvailable when present", async () => {
    (fetchAPIWithParams as any).mockResolvedValue({
      success: true,
      geoLevel: "metro",
      months: 2,
      dates: ["2026-04-01", "2026-05-01"],
      regions: [{ id: "35620", name: "New York", state: "NY", population: 1 }],
      series: {
        propertyiq_score: { "35620": [71, 73] },
        home_value: { "35620": [700000, 705000] },
      },
      totalAvailable: 90,
    });
    const res = await fetchScopeSeries("metro", { months: 2 });
    expect(res.series.propertyiq_score["35620"]).toEqual([71, 73]);
    expect(res.series.home_value["35620"]).toEqual([700000, 705000]);
    expect(res.totalAvailable).toBe(90);
    expect((res as any).metric).toBeUndefined();
  });
});
