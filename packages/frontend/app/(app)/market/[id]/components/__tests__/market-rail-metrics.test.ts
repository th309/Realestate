import { describe, it, expect, vi } from "vitest";

// isMetricSupportedForGeo is data-layer config; stub it so the helper logic is
// tested in isolation (home_value + rent_index supported, cap_rate not).
vi.mock("@/lib/data", () => ({
  isMetricSupportedForGeo: (id: string) =>
    id === "home_value" || id === "rent_index" || id === "days_on_market",
}));

import {
  RAIL_METRIC_IDS,
  timeFrameToHistoryMonths,
  pickDefaultRailMetric,
} from "../market-rail-metrics";

describe("RAIL_METRIC_IDS", () => {
  it("lists the six secondary metrics with home_value first", () => {
    expect(RAIL_METRIC_IDS[0]).toBe("home_value");
    expect(RAIL_METRIC_IDS).toHaveLength(6);
    expect(RAIL_METRIC_IDS).toContain("cap_rate");
  });
});

describe("timeFrameToHistoryMonths", () => {
  it("maps each timeframe to a month count", () => {
    expect(timeFrameToHistoryMonths("1Y")).toBe(12);
    expect(timeFrameToHistoryMonths("3Y")).toBe(36);
    expect(timeFrameToHistoryMonths("5Y")).toBe(60);
    expect(timeFrameToHistoryMonths("10Y")).toBe(120);
    expect(timeFrameToHistoryMonths("Max")).toBe(240);
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
