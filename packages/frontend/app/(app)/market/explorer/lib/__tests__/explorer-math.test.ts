import { describe, it, expect } from "vitest";
import {
  deriveYoY,
  deriveYield,
  deriveMonthsOfSupply,
  aggregateScopeKpis,
  computeMovers,
  makeLogScale,
  formatExplorerValue,
  metricSeriesFor,
  metricColorScalars,
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

describe("metricColorScalars", () => {
  it("index format uses true min-max, higher=greener when betterHigh", () => {
    const scalars = metricColorScalars({ A: 44, B: 58 }, "index", true);
    expect(scalars.A).toBe(0); // the min
    expect(scalars.B).toBe(100); // the max
  });

  it("flips direction for 'lower is better' metrics (e.g. days on market) — fewer days must be greener, not redder", () => {
    // This is the exact bug being fixed: the map/bubble color must react to
    // whichever metric is selected, with the right sense of "good", not stay
    // frozen on PropertyIQ Score.
    const scalars = metricColorScalars({ A: 38, B: 28 }, "days", false);
    expect(scalars.B).toBe(100); // 28 days — fewer, better — greenest
    expect(scalars.A).toBe(0); // 38 days — more, worse — reddest
  });

  it("percent/percent_abs clip to the 5th-95th percentile so one outlier doesn't wash out the gradient", () => {
    // Needs enough points that the 5th/95th percentile index actually lands
    // strictly inside the sorted array (not just rounding to the min/max
    // anyway, which would pass the assertions below for the wrong reason —
    // i.e. without any real clipping happening).
    const values: Record<string, number> = {
      outlierLow: -100,
      outlierHigh: 1000,
    };
    for (let i = 1; i <= 18; i++) values[`v${i}`] = i;
    const scalars = metricColorScalars(values, "percent", true);
    // Both true outliers clamp to the SAME extreme as the 5th/95th
    // percentile neighbor (v1/v18), rather than stretching the scale to fit
    // them and compressing everyone else into a sliver of the ramp.
    expect(scalars.outlierLow).toBe(scalars.v1);
    expect(scalars.outlierHigh).toBe(scalars.v18);
    expect(scalars.v1).toBe(0);
    expect(scalars.v18).toBe(100);
    // A mid-pack value must land meaningfully between the extremes.
    expect(scalars.v9).toBeGreaterThan(0);
    expect(scalars.v9).toBeLessThan(100);
  });

  it("days/months use min-95th (a slow-market tail doesn't compress everyone else)", () => {
    const values: Record<string, number> = { outlierHigh: 500 };
    for (let i = 1; i <= 19; i++) values[`v${i}`] = i;
    const scalars = metricColorScalars(values, "days", false);
    // min stays the TRUE min (no low-end clipping for days/months); only the
    // ceiling is percentile-clipped, so the 500-day outlier clamps to the
    // same worst/reddest value as v19 instead of squashing v1..v19 into a
    // sliver of the ramp.
    expect(scalars.v1).toBe(100); // true min days, betterHigh=false -> greenest
    expect(scalars.outlierHigh).toBe(scalars.v19);
    expect(scalars.v19).toBe(0);
    expect(scalars.v10).toBeGreaterThan(0);
    expect(scalars.v10).toBeLessThan(100);
  });

  it("returns null for regions with no value, without throwing", () => {
    const scalars = metricColorScalars({ A: 50, B: null }, "index", true);
    expect(scalars.B).toBeNull();
    expect(scalars.A).not.toBeNull();
  });

  it("returns a neutral midpoint when every region has the identical value (no divide-by-zero)", () => {
    const scalars = metricColorScalars({ A: 42, B: 42 }, "index", true);
    expect(scalars.A).toBe(50);
    expect(scalars.B).toBe(50);
  });
});

describe("scales + formatting", () => {
  it("makeLogScale maps min→0 and max→1", () => {
    const x = makeLogScale(100, 1000);
    expect(x(100)).toBeCloseTo(0, 6);
    expect(x(1000)).toBeCloseTo(1, 6);
  });
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
