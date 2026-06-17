import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ListingPresentation } from "../ListingPresentation";

/**
 * Regression lock for the report-render contract bug.
 *
 * Unlike ListingPresentation.test.tsx (which mocks every section component),
 * this renders the REAL `listing-sections/*` components against the REAL backend
 * `data` shapes that `ListingPresentationService.generate` emits. The section
 * unit tests mocked the ideal shape, so a 9/10-section crash on real data went
 * unnoticed until a live E2E. This proves the adapter reconciles the contract
 * and the report renders without throwing. See tasks/lessons.md.
 */
function realBackendReport() {
  return {
    report: {
      sections: [
        {
          id: "executive-summary",
          data: {
            score: { scores: { propertyiq: { score: 72, confidence: 85 } } },
            verdict:
              "Boise is a seller's market: 72 out of 100 on tight supply.",
            executiveSummary:
              "Boise's 72 out of 100 PropertyIQ Score sits well above its state average, signaling durable buyer demand.\n\nWith only 2.5 months of supply and homes selling in 25 days, sellers hold clear leverage heading into the next two quarters.",
          },
          limitedData: false,
        },
        {
          id: "market-now",
          data: {
            home_value: 450000,
            rent_index: 1800,
            dom_median: 25,
            months_supply: 2.5,
            pct_sold_above_list: 0.35,
            sale_to_list_ratio: 1.01,
            price_per_sqft: 220,
            household_income_median: 78000,
            pct_bachelors_or_higher: 0.42,
          },
          limitedData: false,
        },
        // Real populated shapes from ListingPresentationSectionsService.
        {
          id: "trajectory-12mo",
          data: {
            series: [
              { label: "Boise", values: [100, 103, 107], yoy: 7.0 },
              { label: "Idaho", values: [100, 102, 104], yoy: 4.0 },
            ],
            limitedData: false,
          },
          limitedData: false,
        },
        {
          id: "forecast",
          data: {
            historic: [440000, 445000, 450000],
            forecast: [452000, 455000, 460000],
            ciLow: [448000, 449000, 451000],
            ciHigh: [456000, 461000, 469000],
            currentValue: 450000,
            projectedValue: 466000,
            ciLow12: 455000,
            ciHigh12: 477000,
            forecast12mPct: 3.5,
            limitedData: false,
          },
          limitedData: false,
        },
        // Peers/migration/employment limited for metros (no county FIPS).
        { id: "peers", data: [], limitedData: true },
        { id: "migration", data: [], limitedData: true },
        {
          id: "affordability",
          data: {
            affordabilityIndex: 64,
            priceToIncome: 4.2,
            affordabilityMarker: 64,
            priceToRent: 18.5,
            priceToRentMarker: 57,
            hasPriceToRent: true,
            limitedData: false,
          },
          limitedData: false,
        },
        {
          id: "employment",
          data: { sectors: [], totalEmployment: 0 },
          limitedData: true,
        },
        {
          id: "validation",
          data: {
            metrosValidated: 865,
            countiesValidated: 3061,
            zipsValidated: 25783,
            backtestYears: 22,
            dollarAlpha: "$7,247",
            icStatement:
              "Out-of-sample information coefficient of 0.27 across 865 metros, positive in every validated year (2001-2023).",
            outperformanceStatement:
              "Top-band markets have outperformed bottom-band markets in the same state by about 1.7 percentage points per year.",
            hitRateStatement: "positive in 100% of validated years",
            geoLevel: "metro",
          },
          limitedData: false,
        },
        {
          id: "ai-strategy",
          data: {
            strategy: "Price at market.\n\nStage for speed.",
            actions: [{ title: "Price to demand", desc: "List at value." }],
            fallbackUsed: false,
          },
          limitedData: false,
        },
      ],
    },
  };
}

const props = {
  report: realBackendReport() as never,
  marketName: "Boise",
  geographyDescription: "Ada County, ID",
  households: 100_000,
  showWatermark: false,
};

describe("ListingPresentation — real backend data (no section mocks)", () => {
  it("renders the full report on real backend section shapes without crashing", () => {
    expect(() => render(<ListingPresentation {...props} />)).not.toThrow();
  });

  it("maps the raw score → the display label (exec-summary really rendered)", () => {
    render(<ListingPresentation {...props} />);
    // getScoreLabel(72) === "GOOD" — proves the raw ScoreResult was mapped, not crashed on.
    expect(screen.getByText("GOOD")).toBeInTheDocument();
  });

  it("maps the metricsBatch Record → market-now stats", () => {
    render(<ListingPresentation {...props} />);
    // "Sold above list" is unique to the MarketNow section (not a hero KPI),
    // so it unambiguously proves the metricsBatch → stats mapping rendered.
    expect(screen.getByText(/Sold above list/i)).toBeInTheDocument();
  });

  it("maps the AI narrative → distinct strategy section + hero verdict (no repeat)", () => {
    render(<ListingPresentation {...props} />);
    // Strategy prose renders in the AI strategy section...
    expect(screen.getByText(/Price at market/i)).toBeInTheDocument();
    // ...and the one-line verdict renders (in the hero), not duplicated as a thesis.
    expect(screen.getByText(/seller's market/i)).toBeInTheDocument();
  });

  it("renders the now-populated trajectory/forecast/affordability/validation sections", () => {
    render(<ListingPresentation {...props} />);
    // forecast: projected price (now shown in BOTH the chart endpoint chip and
    // the summary card) + change derived from the real shapes
    expect(screen.getAllByText("$466K").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("+3.5% vs today")).toBeInTheDocument();
    // affordability: price-to-rent gauge value
    expect(screen.getByText("18.5×")).toBeInTheDocument();
    // validation: geo-level counts (not a per-market claim)
    expect(screen.getByText(/3,061 counties/)).toBeInTheDocument();
  });

  it("does not leak 'undefined' or 'NaN' into the rendered report", () => {
    const { container } = render(<ListingPresentation {...props} />);
    expect(container.textContent ?? "").not.toMatch(/undefined|NaN/);
  });
});
