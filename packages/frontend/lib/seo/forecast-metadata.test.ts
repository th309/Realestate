import { describe, it, expect } from "vitest";
import {
  buildForecastTitle,
  buildForecastDescription,
} from "./forecast-metadata";
import type { MarketStatsData } from "@/lib/data";

const stats = {
  score: 62,
  grade: "B",
  headline: {
    medianPrice: { value: 455000 },
    rent: { value: null },
    daysOnMarket: { value: 48 },
    yoy: { value: 0.031 },
  },
  receipts: [],
  sparkline: [],
  latestDate: "2026-05-31",
} as unknown as MarketStatsData;

describe("forecast metadata builders derive the year from the score period", () => {
  it("puts the display year and forecast intent in the title", () => {
    expect(buildForecastTitle("Austin, TX", stats)).toBe(
      "Austin, TX Housing Market Forecast 2026: Will Prices Drop?",
    );
  });

  it("rolls the title year forward for an October period", () => {
    const octStats = { ...stats, latestDate: "2026-10-31" } as MarketStatsData;
    expect(buildForecastTitle("Austin, TX", octStats)).toContain(
      "Forecast 2027",
    );
  });

  it("includes score and confidence in the description", () => {
    const desc = buildForecastDescription("Austin, TX", stats);
    expect(desc).toContain("PropertyIQ Score 62");
    expect(desc).toContain("confidence B");
  });

  it("degrades honestly without stats", () => {
    const desc = buildForecastDescription("Austin, TX", null);
    expect(desc).toContain("Austin, TX housing market forecast");
    expect(desc).not.toContain("undefined");
  });
});
