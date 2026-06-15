import { describe, it, expect } from "vitest";
import { summarizeScreenerFilters } from "./screener-filter-summary";

describe("summarizeScreenerFilters", () => {
  it("returns an empty array when nothing is active", () => {
    expect(summarizeScreenerFilters({}, "")).toEqual([]);
  });

  it("lists the state filter first", () => {
    expect(summarizeScreenerFilters({}, "DC")).toEqual(["State: DC"]);
  });

  it("describes the Undervalued preset constraints in order", () => {
    expect(
      summarizeScreenerFilters({ scoreMin: 70, overvaluedMax: 0 }, "DC"),
    ).toEqual(["State: DC", "PIQ Score ≥ 70", "Overvalued ≤ 0%"]);
  });

  it("renders a min–max range with an en dash", () => {
    expect(
      summarizeScreenerFilters({ scoreMin: 50, scoreMax: 80 }, ""),
    ).toEqual(["PIQ Score 50–80"]);
  });

  it("formats median price as currency", () => {
    expect(summarizeScreenerFilters({ medianPriceMin: 100000 }, "")).toEqual([
      "Median Price ≥ $100K",
    ]);
  });

  it("describes the Cash-Flow cap-rate floor with a percent", () => {
    expect(summarizeScreenerFilters({ capRateMin: 6 }, "")).toEqual([
      "Cap Rate ≥ 6%",
    ]);
  });
});
