import { describe, it, expect, vi } from "vitest";

// isMetricSupportedForGeo is data-layer config; stub it so the helper logic is
// tested in isolation (home_value + rent_index supported, cap_rate not).
vi.mock("@/lib/data", () => ({
  isMetricSupportedForGeo: (id: string) =>
    id === "home_value" || id === "rent_index" || id === "days_on_market",
}));

import {
  RAIL_METRIC_IDS,
  timeFrameToStartDate,
  pickDefaultRailMetric,
} from "../market-rail-metrics";

describe("RAIL_METRIC_IDS", () => {
  it("lists the six secondary metrics with home_value first", () => {
    expect(RAIL_METRIC_IDS[0]).toBe("home_value");
    expect(RAIL_METRIC_IDS).toHaveLength(6);
    expect(RAIL_METRIC_IDS).toContain("cap_rate");
  });
});

describe("timeFrameToStartDate", () => {
  const YEAR = new Date().getUTCFullYear();

  it("maps each timeframe to a start date N years before today", () => {
    expect(timeFrameToStartDate("1Y").slice(0, 4)).toBe(String(YEAR - 1));
    expect(timeFrameToStartDate("3Y").slice(0, 4)).toBe(String(YEAR - 3));
    expect(timeFrameToStartDate("5Y").slice(0, 4)).toBe(String(YEAR - 5));
    expect(timeFrameToStartDate("10Y").slice(0, 4)).toBe(String(YEAR - 10));
  });

  it("returns a fixed year-2000 floor for Max (fetch all available data)", () => {
    expect(timeFrameToStartDate("Max").slice(0, 4)).toBe("2000");
  });

  it("returns an ISO YYYY-MM-DD date string", () => {
    expect(timeFrameToStartDate("5Y")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("pickDefaultRailMetric", () => {
  it("prefers home_value when supported and present", () => {
    const cards = {
      home_value: { value: 455000 },
      rent_index: { value: 1850 },
    };
    expect(pickDefaultRailMetric(cards, "metro")).toBe("home_value");
  });

  it("falls through to the next supported metric with a value", () => {
    const cards = {
      home_value: { value: null },
      rent_index: { value: 1850 },
    };
    expect(pickDefaultRailMetric(cards, "metro")).toBe("rent_index");
  });

  it("defaults to the first rail metric when nothing has a value", () => {
    expect(pickDefaultRailMetric({}, "metro")).toBe("home_value");
  });
});
