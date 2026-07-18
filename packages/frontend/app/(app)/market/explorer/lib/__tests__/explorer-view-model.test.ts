import { describe, it, expect } from "vitest";
import {
  buildBubbleScalars,
  buildLeaderboardRows,
  coverageConfidence,
} from "../explorer-view-model";

const region = (id: string) => ({ id, name: id, state: "TX", population: 1 });
const series = {
  home_value: { A: [300000, 320000], B: [900000, 950000] },
  rent_index: { A: [2000, 2100], B: [3000, 3100] },
  for_sale_inventory: { A: [1000, 1100], B: [3000, 2900] },
  days_on_market: { A: [40, 38], B: [30, 28] },
  hotness_score: { A: [60, 62], B: [40, 41] },
  new_listings: { A: [100, 110], B: [200, 190] },
  home_sales: { A: [80, 85], B: [150, 140] },
  propertyiq_score: { A: [55, 58], B: [42, 44] },
} as any;

describe("buildBubbleScalars", () => {
  it("slices x=price, y=metric, radius=current inventory at the month; scoreByRegion is always the real PIQ score", () => {
    const s = buildBubbleScalars(
      [region("A"), region("B")],
      series,
      "score",
      1,
    );
    expect(s.xByRegion.A).toBe(320000);
    expect(s.yByRegion.A).toBe(58); // score at month 1
    expect(s.scoreByRegion.B).toBe(44);
    expect(s.radiusByRegion.A).toBe(1100); // latest inventory
  });

  it("colorByRegion tracks the CURRENTLY SELECTED metric, not a value frozen to PropertyIQ Score", () => {
    // Metric "score" happens to equal PIQ score, so this alone wouldn't
    // catch the bug — the second assertion (switching metric to "dom")
    // is the one that actually exercises the fix.
    const scoreMetric = buildBubbleScalars(
      [region("A"), region("B")],
      series,
      "score",
      1,
    );
    expect(scoreMetric.colorByRegion.A).toBe(100); // 58 is the max of {58,44}
    expect(scoreMetric.colorByRegion.B).toBe(0); // 44 is the min

    // Switching to Days on Market (lower is better): A=38, B=28 at month 1.
    // B has fewer days (better) so must come out greener despite being the
    // LOWER PIQ score region — proof color no longer tracks PIQ score.
    const domMetric = buildBubbleScalars(
      [region("A"), region("B")],
      series,
      "dom",
      1,
    );
    expect(domMetric.colorByRegion.B).toBe(100); // fewer days = better = greenest
    expect(domMetric.colorByRegion.A).toBe(0);
  });
});

describe("buildLeaderboardRows", () => {
  it("ranks by the metric (score desc) and labels momentum", () => {
    const rows = buildLeaderboardRows(
      [region("A"), region("B")],
      series,
      "score",
      1,
      0,
      15,
    );
    expect(rows[0].id).toBe("A"); // 58 > 44
    expect(rows[0].rank).toBe("01");
    expect(rows[0].valueLabel).toMatch(/STEADY|FIRMING|RISING/);
  });
});

describe("coverageConfidence", () => {
  it("maps metric coverage to an A/B/C/F level", () => {
    const c = coverageConfidence(series, "A", 1, "2026-05-01");
    expect(c.metricsTotal).toBe(8);
    expect(c.metricsAvailable).toBe(8);
    expect(c.level).toBe("a");
  });
});
