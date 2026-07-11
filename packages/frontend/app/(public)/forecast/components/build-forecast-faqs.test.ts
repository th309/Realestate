import { describe, it, expect } from "vitest";
import { buildForecastFaqs } from "./build-forecast-faqs";
import type { MarketStatsData } from "@/lib/data";

const stats = {
  score: 44,
  grade: "A",
  headline: {
    medianPrice: { value: 455000 },
    rent: { value: null },
    daysOnMarket: { value: 61 },
    yoy: { value: -0.012 },
  },
  receipts: [],
  sparkline: [],
  latestDate: "2026-05-31",
} as unknown as MarketStatsData;

describe("buildForecastFaqs answers the crash question from momentum data only", () => {
  const faqs = buildForecastFaqs({ displayName: "Austin, TX", stats });

  it("produces at least 3 FAQs when data is present", () => {
    expect(faqs.length).toBeGreaterThanOrEqual(3);
  });

  it("leads with the crash question containing the display year", () => {
    expect(faqs[0].question).toBe("Will Austin, TX home prices crash in 2026?");
    expect(faqs[0].answer).toContain("PropertyIQ Score of 44");
    expect(faqs[0].answer).toContain("easing");
  });

  it("never fabricates a price prediction", () => {
    for (const faq of faqs) {
      expect(faq.answer).not.toMatch(/will (fall|drop|rise|crash) \d/i);
    }
  });

  it("returns empty for missing stats (page renders without FAQ)", () => {
    expect(buildForecastFaqs({ displayName: "X", stats: null })).toEqual([]);
  });
});
