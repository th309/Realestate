import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { StatSparkline } from "../StatSparkline";
import { MarketStatsBlock } from "../MarketStatsBlock";
import { buildStatsJsonLd } from "../buildStatsJsonLd";
import type { MarketStatsData } from "@/lib/data";

// ---------------------------------------------------------------------------
// StatSparkline
// ---------------------------------------------------------------------------

describe("StatSparkline", () => {
  it("renders an inline svg polyline for >=2 points (no JS needed)", () => {
    const { container } = render(<StatSparkline data={[10, 20, 15, 30]} />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(container.querySelector("polyline")).toBeTruthy();
  });

  it("renders nothing for fewer than 2 points", () => {
    const { container } = render(<StatSparkline data={[10]} />);
    expect(container.querySelector("svg")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Shared fixture
// ---------------------------------------------------------------------------

const data: MarketStatsData = {
  score: 72,
  grade: "B",
  headline: {
    medianPrice: {
      metricId: "home_value",
      label: "Median Price",
      value: 469000,
      source: "zillow",
      date: "2026-04-30",
    },
    rent: {
      metricId: "rent_index",
      label: "Rent (ZORI)",
      value: 1604,
      source: "zillow",
      date: "2026-04-30",
    },
    daysOnMarket: {
      metricId: "days_on_market",
      label: "Median DOM",
      value: 90,
      source: "realtor",
      date: "2026-04-01",
    },
    yoy: {
      metricId: "home_value_yoy",
      label: "YoY",
      value: 2.1,
      source: "zillow",
      date: "2026-04-30",
    },
  },
  receipts: [
    { key: "zhvi_yoy", label: "Home value YoY", value: 2.1, format: "percent" },
    {
      key: "zhvi_mom_3m",
      label: "3-mo momentum",
      value: 0.8,
      format: "percent",
    },
    {
      key: "median_days_on_market",
      label: "Days on market",
      value: 90,
      format: "days",
    },
    {
      key: "price_reduced_share",
      label: "Price-reduced share",
      value: null,
      format: "percent",
    },
  ],
  sparkline: [480000, 455000, 469000],
  latestDate: "2026-04-30",
};

// ---------------------------------------------------------------------------
// MarketStatsBlock
// ---------------------------------------------------------------------------

describe("MarketStatsBlock", () => {
  it("renders headline values in server HTML", () => {
    const { container } = render(
      <MarketStatsBlock data={data} geoName="Austin, TX" />,
    );
    expect(container.textContent).toContain("Median Price");
    expect(container.textContent).toContain("$469K");
    expect(container.textContent).toContain("90 days");
  });

  it("renders an em-dash for a missing receipt, never 0", () => {
    const { container } = render(
      <MarketStatsBlock data={data} geoName="Austin, TX" />,
    );
    const strip = container.querySelector('[data-testid="score-receipts"]')!;
    expect(strip.textContent).toContain("—"); // price-reduced-share is null
  });

  it("shows a freshness/attribution line with the latest date and sources", () => {
    const { container } = render(
      <MarketStatsBlock data={data} geoName="Austin, TX" />,
    );
    expect(container.textContent?.toLowerCase()).toContain("data through");
    expect(container.textContent?.toLowerCase()).toContain("zillow");
  });

  it("renders gracefully when score is null (stats only, no receipts crash)", () => {
    const noScore = {
      ...data,
      score: null,
      grade: null,
      receipts: data.receipts.map((r) => ({ ...r, value: null })),
    };
    const { container } = render(
      <MarketStatsBlock data={noScore} geoName="Nowhere, TX" />,
    );
    expect(container.textContent).toContain("Median Price");
  });
});

// ---------------------------------------------------------------------------
// buildStatsJsonLd
// ---------------------------------------------------------------------------

describe("buildStatsJsonLd", () => {
  it("emits a Dataset with dateModified = latest period and the stat variables", () => {
    const ld = buildStatsJsonLd(
      data,
      "Austin, TX",
      "https://propertyiq.up.railway.app/markets/austin-tx",
    );
    expect(ld["@type"]).toBe("Dataset");
    expect(ld.dateModified).toBe("2026-04-30");
    expect(JSON.stringify(ld)).toContain("Median Price");
    expect(ld.url).toContain("/markets/austin-tx");
  });
});
