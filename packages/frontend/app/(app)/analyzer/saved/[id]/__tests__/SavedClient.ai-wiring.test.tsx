import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { vi } from "vitest";

/**
 * Happy-path render covering the persisted-AI wiring: `result_snapshot.aiNarratives`
 * must reach both <Hero aiText> (via `recommendation_analysis`) and
 * <MarketContextSection aiText> (via `extractMarketContextProps`'s
 * `market_context ?? comps` preference) with zero live network calls.
 */

const mockRow = {
  id: "sa-1",
  share_token: "tok-1",
  label: null as string | null,
  address_full: "123 Main St, Austin, TX",
  address_city: "Austin",
  address_state: "TX",
  address_zip: "78704",
  lat: null,
  lon: null,
  input_snapshot: {},
  result_snapshot: {
    rental: {
      capRatePct: 7.2,
      cashOnCashPct: 9.1,
      cashflowMonthly: 250,
      dscr: 1.25,
      noiAnnual: 12_000,
    },
    flip: null,
    brrrr: null,
    notes: null,
    aiNarratives: {
      recommendation_analysis: "This is a solid buy-and-hold candidate.",
      market_context: "Austin metro momentum is firming.",
    },
  },
  market_context: {
    geo_level: "metro",
    piq_score: { value: 68 },
    home_value: { value: 425_000 },
  },
  ai_verdict: null,
  created_at: "2026-07-01T00:00:00Z",
};

vi.mock("@/lib/analyzer/useSavedAnalysis", () => ({
  useSavedAnalysis: () => ({ data: mockRow, isLoading: false }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={typeof href === "string" ? href : ""} {...rest}>
      {children}
    </a>
  ),
}));
// MarketContextSection calls useQueryClient() to invalidate per-geo AI
// queries on refresh; no QueryClientProvider is mounted in this test.
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: () => Promise.resolve() }),
  };
});
// useMarketContextByGeo calls useMarketContext + useAiSectionAnnotation 3x
// at mount (metro/county/zip); chain=null on the saved path so these are
// disabled anyway, but stub them so the section renders on fallback props.
vi.mock("@/lib/data", () => ({
  useMarketContext: () => ({ data: null, isLoading: false, error: null }),
  useAiSectionAnnotation: () => ({ data: null, isLoading: false }),
}));

import SavedClient from "../SavedClient";

describe("Analyzer SavedClient AI wiring", () => {
  it("renders the resolved label (resolveSavedAnalysisLabel) as the page title", () => {
    const { getByRole } = render(<SavedClient id="sa-1" />);
    expect(getByRole("heading", { level: 1 }).textContent).toBe(
      "123 Main St, Austin, TX",
    );
  });

  it("passes the persisted recommendation_analysis narrative into Hero's AI quote", () => {
    const { container } = render(<SavedClient id="sa-1" />);
    expect(
      container.querySelector("[data-ai-quote-header]")?.textContent,
    ).toContain("This is a solid buy-and-hold candidate.");
  });

  it("passes the persisted market_context narrative into MarketContextSection", () => {
    const { container } = render(<SavedClient id="sa-1" />);
    expect(container.textContent).toContain(
      "Austin metro momentum is firming.",
    );
  });
});
