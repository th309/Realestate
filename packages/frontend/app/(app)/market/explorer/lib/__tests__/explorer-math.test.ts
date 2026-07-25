import { describe, it, expect } from "vitest";
import {
  deriveYoY,
  deriveYield,
  deriveMonthsOfSupply,
  aggregateScopeKpis,
  computeMovers,
  formatExplorerValue,
  metricSeriesFor,
} from "../explorer-math";

describe("explorer-math derivations", () => {
  it("deriveYoY compares against 12 months back", () => {
    const s = Array.from({ length: 13 }, (_, i) => 100 + i);
    const yoy = deriveYoY(s);
    expect(yoy.slice(0, 12).every((v) => v === null)).toBe(true);
    expect(yoy[12]).toBeCloseTo((112 / 100 - 1) * 100, 6); // +12%
  });
  it("deriveYield = rent*12/home*100", () => {
    expect(deriveYield([2000], [480000])[0]).toBeCloseTo(5, 6);
  });
  it("deriveMonthsOfSupply = active/pending, null when pending is 0/null", () => {
    expect(deriveMonthsOfSupply([300, 300], [100, 0])).toEqual([3, null]);
  });
});

describe("aggregateScopeKpis", () => {
  it("means levels and sums inventory across regions per month", () => {
    const series = {
      home_value: { A: [100, 200], B: [300, 400] },
      rent_index: { A: [1, 2], B: [3, 4] },
      for_sale_inventory: { A: [10, 20], B: [30, 40] },
      days_on_market: { A: [5, 6], B: [7, 8] },
      propertyiq_score: { A: [50, 60], B: [70, 80] },
    };
    const agg = aggregateScopeKpis(["A", "B"], series, 2);
    expect(agg.price).toEqual([200, 300]);
    expect(agg.inventory).toEqual([40, 60]);
    expect(agg.score).toEqual([60, 70]);
  });

  it("derives homeValueYoy from the aggregate price series (12 months back), for the state-scope KPI card", () => {
    const home = Array.from({ length: 13 }, (_, i) => 100 + i); // aggregate mean price, month 12 = 112
    const series = { home_value: { A: home } };
    const agg = aggregateScopeKpis(["A"], series, 13);
    expect(agg.homeValueYoy.slice(0, 12).every((v) => v === null)).toBe(true);
    expect(agg.homeValueYoy[12]).toBeCloseTo((112 / 100 - 1) * 100, 6);
  });

  it("unemployment degrades to an all-null series when the scope's data has no unemployment_rate at all (every non-state geo level)", () => {
    const series = {
      home_value: { A: [100, 200], B: [300, 400] },
    };
    const agg = aggregateScopeKpis(["A", "B"], series, 2);
    expect(agg.unemployment).toEqual([null, null]);
  });
});

describe("computeMovers", () => {
  it("returns top and bottom by 3-month score delta", () => {
    const regions = [
      { id: "A", name: "A", state: "X", population: null },
      { id: "B", name: "B", state: "X", population: null },
    ];
    const scoreByRegion = { A: [50, 50, 50, 60], B: [50, 50, 50, 40] };
    const movers = computeMovers(regions as any, scoreByRegion, 3);
    expect(movers[0].region.id).toBe("A");
    expect(movers[0].delta).toBe(10);
    expect(movers[movers.length - 1].delta).toBe(-10);
  });
});

describe("formatting", () => {
  it("formatExplorerValue renders each metric format and handles null", () => {
    expect(formatExplorerValue(null, "index")).toBe("—");
    expect(formatExplorerValue(72.4, "index")).toBe("72");
    expect(formatExplorerValue(5.2, "percent_abs")).toBe("5.2%");
    expect(formatExplorerValue(45, "days")).toBe("45 d");
    expect(formatExplorerValue(3.14, "months")).toBe("3.1 mo");
  });
  it("metricSeriesFor resolves a derived metric", () => {
    const series = {
      home_value: { A: Array.from({ length: 13 }, (_, i) => 100 + i) },
    };
    const yoy = metricSeriesFor("home_value_yoy", series as any, "A");
    expect(yoy[12]).toBeCloseTo(12, 6);
  });
});
