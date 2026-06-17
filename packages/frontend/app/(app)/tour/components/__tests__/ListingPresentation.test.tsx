import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ListingPresentation } from "../ListingPresentation";

vi.mock("../ReportHero", () => ({
  ReportHero: (p: any) => <div data-testid="hero" data-market={p.marketName} />,
}));
vi.mock("../listing-sections/ExecutiveSummary", () => ({
  ExecutiveSummary: (p: any) => (
    <div
      data-testid="exec"
      data-limited={String(p.limitedData)}
      data-num={p.num}
    />
  ),
}));
vi.mock("../listing-sections/MarketNow", () => ({
  MarketNow: (p: any) => (
    <div
      data-testid="market-now"
      data-limited={String(p.limitedData)}
      data-num={p.num}
    />
  ),
}));
vi.mock("../listing-sections/Trajectory", () => ({
  Trajectory: (p: any) => (
    <div
      data-testid="trajectory"
      data-limited={String(p.limitedData)}
      data-num={p.num}
    />
  ),
}));
vi.mock("../listing-sections/Forecast", () => ({
  Forecast: (p: any) => (
    <div
      data-testid="forecast"
      data-limited={String(p.limitedData)}
      data-num={p.num}
    />
  ),
}));
vi.mock("../listing-sections/Peers", () => ({
  Peers: (p: any) => (
    <div
      data-testid="peers"
      data-limited={String(p.limitedData)}
      data-num={p.num}
    />
  ),
}));
vi.mock("../listing-sections/Migration", () => ({
  Migration: (p: any) => (
    <div
      data-testid="migration"
      data-limited={String(p.limitedData)}
      data-num={p.num}
    />
  ),
}));
vi.mock("../listing-sections/Affordability", () => ({
  Affordability: (p: any) => (
    <div
      data-testid="affordability"
      data-limited={String(p.limitedData)}
      data-num={p.num}
    />
  ),
}));
vi.mock("../listing-sections/Employment", () => ({
  Employment: (p: any) => (
    <div
      data-testid="employment"
      data-limited={String(p.limitedData)}
      data-num={p.num}
    />
  ),
}));
vi.mock("../listing-sections/Validation", () => ({
  Validation: (p: any) => (
    <div
      data-testid="validation"
      data-limited={String(p.limitedData)}
      data-num={p.num}
    />
  ),
}));
vi.mock("../listing-sections/AiStrategy", () => ({
  AiStrategy: (p: any) => (
    <div
      data-testid="ai-strategy"
      data-fallback={String(p.fallbackUsed)}
      data-num={p.num}
    />
  ),
}));

// REAL backend section shapes (as ListingPresentationService.generate emits),
// fed through the adapter — NOT the fabricated ideal shapes that masked the
// contract crash. See tasks/lessons.md.
//
// trajectory/forecast/affordability/validation carry `data: {}` here, so the
// adapter flags them `limitedData` — they are DROPPED by the no-empty-sections
// rule. `makeFullReport()` below exercises the all-populated path.
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

// Every section populated with data the adapter keeps → all 10 render, 01..10.
function makeFullReport() {
  const r = makeReport();
  const set = (id: string, data: unknown) => {
    const sec = r.report.sections.find((x) => x.id === id)!;
    sec.data = data as never;
  };
  set("trajectory-12mo", {
    series: [
      { label: "Boise", values: [100, 103, 107], yoy: 7.0 },
      { label: "Idaho", values: [100, 102, 104], yoy: 4.0 },
    ],
  });
  set("forecast", {
    historic: [440000, 445000, 450000],
    forecast: [452000, 455000, 460000],
    ciLow: [448000, 449000, 451000],
    ciHigh: [456000, 461000, 469000],
    projectedValue: 466000,
    ciLow12: 455000,
    ciHigh12: 477000,
    forecast12mPct: 3.5,
  });
  set("affordability", {
    affordabilityIndex: 64,
    priceToIncome: 4.2,
    affordabilityMarker: 64,
    priceToRent: 18.5,
    priceToRentMarker: 57,
    hasPriceToRent: true,
  });
  set("validation", {
    metrosValidated: 865,
    countiesValidated: 3061,
    zipsValidated: 25783,
    backtestYears: 22,
    dollarAlpha: "$7,247",
    icStatement: "IC 0.27.",
    outperformanceStatement: "Top band outperforms.",
    hitRateStatement: "positive in 100% of validated years",
  });
  return r;
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

  it("drops limitedData sections and renumbers the survivors sequentially", () => {
    render(<ListingPresentation {...baseProps} />);
    // trajectory/forecast/affordability/validation have empty data → dropped.
    ["trajectory", "forecast", "affordability", "validation"].forEach((id) => {
      expect(screen.queryByTestId(id)).toBeNull();
    });
    // Survivors are renumbered 01..06 in document order, with no gaps.
    expect(screen.getByTestId("exec").getAttribute("data-num")).toBe("01");
    expect(screen.getByTestId("market-now").getAttribute("data-num")).toBe(
      "02",
    );
    expect(screen.getByTestId("peers").getAttribute("data-num")).toBe("03");
    expect(screen.getByTestId("migration").getAttribute("data-num")).toBe("04");
    expect(screen.getByTestId("employment").getAttribute("data-num")).toBe(
      "05",
    );
    expect(screen.getByTestId("ai-strategy").getAttribute("data-num")).toBe(
      "06",
    );
  });

  it("renders all 10 sections numbered 01..10 when every section has data", () => {
    render(
      <ListingPresentation {...baseProps} report={makeFullReport() as any} />,
    );
    const expected: [string, string][] = [
      ["exec", "01"],
      ["market-now", "02"],
      ["trajectory", "03"],
      ["forecast", "04"],
      ["peers", "05"],
      ["migration", "06"],
      ["affordability", "07"],
      ["employment", "08"],
      ["validation", "09"],
      ["ai-strategy", "10"],
    ];
    expected.forEach(([id, num]) => {
      expect(screen.getByTestId(id).getAttribute("data-num")).toBe(num);
    });
  });

  it("drops a section the report flags limitedData and renumbers the rest", () => {
    render(
      <ListingPresentation
        {...baseProps}
        report={makeReport({ execLimited: true }) as any}
      />,
    );
    // Executive summary is flagged limited → dropped entirely (no stub).
    expect(screen.queryByTestId("exec")).toBeNull();
    // The next survivor becomes 01.
    expect(screen.getByTestId("market-now").getAttribute("data-num")).toBe(
      "01",
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
