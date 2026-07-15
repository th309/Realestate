import { describe, it, expect } from "vitest";
import {
  EXPLORER_METRICS,
  FETCHED_METRICS,
  RANGE_PRESETS,
  US_STATE_TILES,
  childGeoLevel,
} from "../explorer-config";

describe("explorer-config", () => {
  it("has exactly the 6 switcher metrics with unique ids", () => {
    expect(EXPLORER_METRICS.map((m) => m.id)).toEqual([
      "score",
      "hotness",
      "home_value_yoy",
      "rent_yield",
      "dom",
      "supply",
    ]);
  });
  it("fetches 8 core timeseries metrics", () => {
    expect(FETCHED_METRICS).toHaveLength(8);
    expect(FETCHED_METRICS).toContain("propertyiq_score");
    expect(FETCHED_METRICS).toContain("home_sales");
  });
  it("derived metrics reference valid derivers", () => {
    const derived = EXPLORER_METRICS.filter((m) => m.source.kind === "derived");
    expect(derived.map((m) => m.id).sort()).toEqual([
      "home_value_yoy",
      "rent_yield",
      "supply",
    ]);
  });
  it("exposes the 5 range presets", () => {
    expect(RANGE_PRESETS.map((r) => r.months)).toEqual([6, 12, 24, 60, 120]);
  });
  it("positions all 50 states + DC on the tile grid", () => {
    expect(Object.keys(US_STATE_TILES)).toHaveLength(51);
    expect(US_STATE_TILES.TX).toEqual([3, 7]);
    expect(US_STATE_TILES.DC).toEqual([9, 5]);
  });
  it("maps scope level to its child level", () => {
    expect(childGeoLevel(null)).toBe("metro");
    expect(childGeoLevel("state")).toBe("metro");
    expect(childGeoLevel("metro")).toBe("county");
    expect(childGeoLevel("county")).toBe("zip");
  });
});
