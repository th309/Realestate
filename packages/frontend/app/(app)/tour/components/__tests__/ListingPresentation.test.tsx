import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ListingPresentation } from "../ListingPresentation";

vi.mock("../ReportHero", () => ({
  ReportHero: (p: any) => <div data-testid="hero" data-market={p.marketName} />,
}));
vi.mock("../listing-sections/ExecutiveSummary", () => ({
  ExecutiveSummary: (p: any) => (
    <div data-testid="exec" data-limited={String(p.limitedData)} />
  ),
}));
vi.mock("../listing-sections/MarketNow", () => ({
  MarketNow: (p: any) => (
    <div data-testid="market-now" data-limited={String(p.limitedData)} />
  ),
}));
vi.mock("../listing-sections/Trajectory", () => ({
  Trajectory: (p: any) => (
    <div data-testid="trajectory" data-limited={String(p.limitedData)} />
  ),
}));
vi.mock("../listing-sections/Forecast", () => ({
  Forecast: (p: any) => (
    <div data-testid="forecast" data-limited={String(p.limitedData)} />
  ),
}));
vi.mock("../listing-sections/Peers", () => ({
  Peers: (p: any) => (
    <div data-testid="peers" data-limited={String(p.limitedData)} />
  ),
}));
vi.mock("../listing-sections/Migration", () => ({
  Migration: (p: any) => (
    <div data-testid="migration" data-limited={String(p.limitedData)} />
  ),
}));
vi.mock("../listing-sections/Affordability", () => ({
  Affordability: (p: any) => (
    <div data-testid="affordability" data-limited={String(p.limitedData)} />
  ),
}));
vi.mock("../listing-sections/Employment", () => ({
  Employment: (p: any) => (
    <div data-testid="employment" data-limited={String(p.limitedData)} />
  ),
}));
vi.mock("../listing-sections/Validation", () => ({
  Validation: (p: any) => (
    <div data-testid="validation" data-limited={String(p.limitedData)} />
  ),
}));
vi.mock("../listing-sections/AiStrategy", () => ({
  AiStrategy: (p: any) => (
    <div data-testid="ai-strategy" data-fallback={String(p.fallbackUsed)} />
  ),
}));

// REAL backend section shapes (as ListingPresentationService.generate emits),
// fed through the adapter — NOT the fabricated ideal shapes that masked the
// contract crash. See tasks/lessons.md.
function makeReport(opts?: { execLimited?: boolean }) {
  return {
    report: {
      sections: [
        {
          id: "executive-summary",
          data: {
            score: { scores: { propertyiq: { score: 72, confidence: 85 } } },
            thesis: "Boise scores 72 — strong demand on tight supply.",
          },
          limitedData: opts?.execLimited ?? false,
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
        { id: "trajectory-12mo", data: {}, limitedData: false },
        { id: "forecast", data: {}, limitedData: false },
        {
          id: "peers",
          data: [{ name: "Spokane", score: 64 }],
          limitedData: false,
        },
        {
          id: "migration",
          data: [{ origin: "California", netFlow: 5000 }],
          limitedData: false,
        },
        { id: "affordability", data: {}, limitedData: false },
        {
          id: "employment",
          data: {
            sectors: [{ label: "Tech", value: 0.18 }],
            totalEmployment: 250000,
          },
          limitedData: false,
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

const baseProps = {
  report: makeReport() as any,
  marketName: "Charlotte",
  geographyDescription: "Mecklenburg County, NC",
  households: 125_000,
  showWatermark: true,
};

describe("ListingPresentation", () => {
  it("renders the hero with the resolved marketName", () => {
    render(<ListingPresentation {...baseProps} />);
    // Trajectory is empty in this fixture, so the resolved name falls back to
    // the marketName prop.
    expect(screen.getByTestId("hero").getAttribute("data-market")).toBe(
      "Charlotte",
    );
  });

  it("renders all 10 sections by testid", () => {
    render(<ListingPresentation {...baseProps} />);
    [
      "exec",
      "market-now",
      "trajectory",
      "forecast",
      "peers",
      "migration",
      "affordability",
      "employment",
      "validation",
      "ai-strategy",
    ].forEach((id) => {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    });
  });

  it("propagates limitedData from report.sections to each section", () => {
    render(
      <ListingPresentation
        {...baseProps}
        report={makeReport({ execLimited: true }) as any}
      />,
    );
    expect(screen.getByTestId("exec").getAttribute("data-limited")).toBe(
      "true",
    );
    expect(screen.getByTestId("market-now").getAttribute("data-limited")).toBe(
      "false",
    );
  });

  it("renders the demo watermark banner when showWatermark=true", () => {
    render(<ListingPresentation {...baseProps} showWatermark={true} />);
    expect(screen.getByText(/Demo report/i)).toBeInTheDocument();
    expect(screen.getByText(/Save my report/i)).toBeInTheDocument();
  });

  it("does NOT render the demo banner when showWatermark=false", () => {
    render(<ListingPresentation {...baseProps} showWatermark={false} />);
    expect(screen.queryByText(/Demo report/i)).not.toBeInTheDocument();
  });

  it("renders the data sources footer", () => {
    render(<ListingPresentation {...baseProps} />);
    expect(screen.getByText(/Data sources/i)).toBeInTheDocument();
    expect(screen.getByText(/Zillow ZHVI/i)).toBeInTheDocument();
    expect(screen.getByText(/Realtor\.com/i)).toBeInTheDocument();
  });

  it("renders the #signup-cta anchor target for Phase 05", () => {
    const { container } = render(<ListingPresentation {...baseProps} />);
    const link = container.querySelector('a[href="#signup-cta"]');
    expect(link).toBeTruthy();
  });

  it("does not hardcode hex colors in markup", () => {
    const { container } = render(<ListingPresentation {...baseProps} />);
    expect(container.innerHTML).not.toMatch(/#[0-9A-Fa-f]{6}/);
  });
});
