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
            thesis: "Boise scores 72 — strong demand on tight supply.",
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
        // Backend currently emits these four as empty stubs (limitedData:false).
        { id: "trajectory-12mo", data: {}, limitedData: false },
        { id: "forecast", data: {}, limitedData: false },
        // Peers/migration/employment limited for metros (no county FIPS).
        { id: "peers", data: [], limitedData: true },
        { id: "migration", data: [], limitedData: true },
        { id: "affordability", data: {}, limitedData: false },
        {
          id: "employment",
          data: { sectors: [], totalEmployment: 0 },
          limitedData: true,
        },
        { id: "validation", data: {}, limitedData: false },
        {
          id: "ai-strategy",
          data: {
            thesis: "Position aggressively; demand outpaces supply.",
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
    expect(screen.getByText(/Days on market/i)).toBeInTheDocument();
  });

  it("maps the AI narrative → the strategy thesis", () => {
    render(<ListingPresentation {...props} />);
    expect(screen.getByText(/Position aggressively/i)).toBeInTheDocument();
  });

  it("does not leak 'undefined' or 'NaN' into the rendered report", () => {
    const { container } = render(<ListingPresentation {...props} />);
    expect(container.textContent ?? "").not.toMatch(/undefined|NaN/);
  });
});
