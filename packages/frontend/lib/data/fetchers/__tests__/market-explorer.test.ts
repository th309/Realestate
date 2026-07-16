import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("../base", () => ({ fetchAPIWithParams: vi.fn() }));
import { fetchAPIWithParams } from "../base";
import { fetchScopeSeries } from "../market-explorer";

describe("fetchScopeSeries", () => {
  beforeEach(() => vi.clearAllMocks());

  it("builds the scope URL and forwards query params", async () => {
    (fetchAPIWithParams as any).mockResolvedValue({
      success: true,
      geoLevel: "county",
      metric: "home_value",
      months: 120,
      dates: [],
      regions: [],
      series: {},
    });
    await fetchScopeSeries("county", {
      parentLevel: "metro",
      parentId: "19100",
      metric: "home_value",
      months: 120,
    });
    expect(fetchAPIWithParams).toHaveBeenCalledWith(
      "/api/market-explorer/scope/county",
      {
        parentLevel: "metro",
        parentId: "19100",
        metric: "home_value",
        months: 120,
      },
    );
  });

  it("omits parent params at national scope", async () => {
    (fetchAPIWithParams as any).mockResolvedValue({
      success: true,
      regions: [],
      series: {},
      dates: [],
    });
    await fetchScopeSeries("metro", { metric: "propertyiq_score", months: 24 });
    expect(fetchAPIWithParams).toHaveBeenCalledWith(
      "/api/market-explorer/scope/metro",
      {
        parentLevel: undefined,
        parentId: undefined,
        metric: "propertyiq_score",
        months: 24,
      },
    );
  });
});
