import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ListingPresentation } from "../ListingPresentation";

vi.mock("../ListingPresentationCover", () => ({
  ListingPresentationCover: (p: any) => (
    <div data-testid="cover" data-market={p.marketName} />
  ),
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

function makeReport(opts?: { execLimited?: boolean }) {
  return {
    report: {
      sections: [
        {
          id: "executive-summary",
          data: {
            score: {
              score: 70,
              label: "GOOD",
              confidenceLetter: "B",
              confidencePercent: 70,
            },
            thesisParagraphs: ["t"],
            recommendation: "r",
          },
          limitedData: opts?.execLimited ?? false,
        },
        { id: "market-now", data: { stats: [] }, limitedData: false },
        { id: "trajectory-12mo", data: {}, limitedData: false },
        { id: "forecast", data: {}, limitedData: false },
        { id: "peers", data: {}, limitedData: false },
        { id: "migration", data: {}, limitedData: false },
        { id: "affordability", data: {}, limitedData: false },
        { id: "employment", data: {}, limitedData: false },
        { id: "validation", data: {}, limitedData: false },
        {
          id: "ai-strategy",
          data: { fallbackUsed: false },
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
  it("renders the Cover with marketName", () => {
    render(<ListingPresentation {...baseProps} />);
    expect(screen.getByTestId("cover").getAttribute("data-market")).toBe(
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
    expect(screen.getByText(/Zillow/i)).toBeInTheDocument();
    expect(screen.getByText(/Redfin/i)).toBeInTheDocument();
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
