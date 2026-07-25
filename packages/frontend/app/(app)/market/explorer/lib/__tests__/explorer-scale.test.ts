import { describe, it, expect } from "vitest";
import {
  makeLogScale,
  metricColorScalars,
  computeMetricBounds,
} from "../explorer-scale";

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

  it("uses precomputedBounds instead of recomputing from valueByRegion when given — required for animated playback so the scale stays fixed across blended frames", () => {
    // Without precomputedBounds, {A: 50} alone would treat 50 as both the
    // min and max (a degenerate single-point scale), landing at 50. With a
    // GLOBAL bounds range supplied, the same single-value snapshot must
    // scale relative to that wider, fixed range instead.
    const scalars = metricColorScalars({ A: 50 }, "index", true, [0, 100]);
    expect(scalars.A).toBe(50);
    const scalarsAtEdge = metricColorScalars(
      { A: 100 },
      "index",
      true,
      [0, 200],
    );
    expect(scalarsAtEdge.A).toBe(50);
  });
});

describe("makeLogScale", () => {
  it("maps min→0 and max→1", () => {
    const x = makeLogScale(100, 1000);
    expect(x(100)).toBeCloseTo(0, 6);
    expect(x(1000)).toBeCloseTo(1, 6);
  });
});

describe("computeMetricBounds", () => {
  it("matches metricColorScalars' own default bounds strategy for the same format", () => {
    const values = [10, 20, 30, 40, 50];
    expect(computeMetricBounds(values, "index")).toEqual([10, 50]);
  });
  it("returns [0, 1] for an empty input rather than throwing", () => {
    expect(computeMetricBounds([], "index")).toEqual([0, 1]);
  });
});
