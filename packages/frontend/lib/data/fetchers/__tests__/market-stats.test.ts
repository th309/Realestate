import { describe, it, expect } from "vitest";
import { assembleMarketStats } from "../market-stats";
import type { MarketSnapshotResponse } from "../market-snapshot";
import type { TimeSeriesResult } from "../../types";

const snapshot: MarketSnapshotResponse = {
  success: true,
  geography: { id: "12420", name: "Austin, TX", type: "metro" },
  scores: {
    propertyiq: {
      score: 72,
      grade: "B",
      components: {
        zhvi_yoy: 0.021,
        zhvi_mom_3m: 0.008,
        median_days_on_market: 90,
        price_reduced_share: 0.18,
      },
    },
  },
  metrics: {
    home_value: {
      value: 469000,
      date: "2026-04-30",
      source: "zillow",
      sourceGeoId: "12420",
      sourceGeoLevel: "metro",
      isInherited: false,
      isFallback: false,
    },
    rent_index: {
      value: 1604,
      date: "2026-04-30",
      source: "zillow",
      sourceGeoId: "12420",
      sourceGeoLevel: "metro",
      isInherited: false,
      isFallback: false,
    },
    days_on_market: {
      value: 90,
      date: "2026-04-01",
      source: "realtor",
      sourceGeoId: "12420",
      sourceGeoLevel: "metro",
      isInherited: false,
      isFallback: false,
    },
  },
  lastUpdated: "2026-04-30",
};

const timeseries = {
  success: true,
  metric: "home_value",
  geoLevel: "metro",
  regionId: "12420",
  count: 3,
  data: [
    { date: "2025-05-31", value: 480000 },
    { date: "2025-11-30", value: 455000 },
    { date: "2026-04-30", value: 469000 },
  ],
} as unknown as TimeSeriesResult;

describe("assembleMarketStats", () => {
  it("maps headline price/rent from snapshot metrics with source+date", () => {
    const out = assembleMarketStats(snapshot, timeseries);
    expect(out.headline.medianPrice.value).toBe(469000);
    expect(out.headline.medianPrice.source).toBe("zillow");
    expect(out.headline.medianPrice.date).toBe("2026-04-30");
    expect(out.headline.rent.value).toBe(1604);
  });

  it("sources headline YoY and DOM from score components so they match the receipts", () => {
    const out = assembleMarketStats(snapshot, timeseries);
    // 0.021 fraction -> 2.1 percent units
    expect(out.headline.yoy.value).toBeCloseTo(2.1, 5);
    expect(out.headline.daysOnMarket.value).toBe(90);
    const yoyReceipt = out.receipts.find((r) => r.key === "zhvi_yoy");
    expect(yoyReceipt?.value).toBeCloseTo(2.1, 5);
  });

  it("returns all four receipts in fixed order with correct formats", () => {
    const out = assembleMarketStats(snapshot, timeseries);
    expect(out.receipts.map((r) => r.key)).toEqual([
      "zhvi_yoy",
      "zhvi_mom_3m",
      "median_days_on_market",
      "price_reduced_share",
    ]);
    expect(
      out.receipts.find((r) => r.key === "median_days_on_market")?.format,
    ).toBe("days");
    expect(
      out.receipts.find((r) => r.key === "price_reduced_share")?.value,
    ).toBeCloseTo(18, 5);
  });

  it("renders null per-field when a component is missing (low-confidence row)", () => {
    const lowConf = {
      ...snapshot,
      scores: {
        propertyiq: {
          score: 40,
          grade: "F",
          components: {
            zhvi_yoy: 0.01,
            zhvi_mom_3m: 0.002,
            median_days_on_market: null as unknown as number,
            price_reduced_share: null as unknown as number,
          },
        },
      },
    } as MarketSnapshotResponse;
    const out = assembleMarketStats(lowConf, timeseries);
    expect(
      out.receipts.find((r) => r.key === "median_days_on_market")?.value,
    ).toBeNull();
    expect(out.headline.daysOnMarket.value).toBeNull();
  });

  it("extracts a numeric sparkline series from the timeseries", () => {
    const out = assembleMarketStats(snapshot, timeseries);
    expect(out.sparkline).toEqual([480000, 455000, 469000]);
  });

  it("returns null score block when there is no score", () => {
    const noScore = {
      ...snapshot,
      scores: { propertyiq: null },
    } as MarketSnapshotResponse;
    const out = assembleMarketStats(noScore, timeseries);
    expect(out.score).toBeNull();
    expect(out.receipts.every((r) => r.value === null)).toBe(true);
  });
});
