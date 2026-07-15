import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// MarketDashboard calls useQueryClient() to invalidate the snapshot query on
// refresh. The test environment has no QueryClientProvider, so stub the hook
// with a no-op invalidator instead of standing up a full provider (same
// pattern as MarketContextSection.test.tsx).
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: () => Promise.resolve() }),
  };
});

// Mock the one-call snapshot hook so no network fires.
vi.mock("@/lib/data", async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>);
  return {
    ...actual,
    useMarketSnapshot: () => ({
      cards: {
        home_value: {
          value: 455000,
          formattedValue: "$455K",
          percentChange: 3.1,
          direction: "up",
          isLoading: false,
          date: "2026-05-31",
          source: "zillow",
          sourceGeoId: "12420",
          sourceGeoLevel: "metro",
          isInherited: false,
          isFallback: false,
        },
        rent_index: {
          value: 1850,
          formattedValue: "$1,850",
          percentChange: 1.2,
          direction: "up",
          isLoading: false,
          date: "2026-05-31",
          source: "zillow",
          sourceGeoId: "12420",
          sourceGeoLevel: "metro",
          isInherited: false,
          isFallback: false,
        },
      },
      scores: { propertyiq: { score: 62 } },
      geography: { name: "Austin, TX" },
      lastUpdated: "2026-05-31",
      dataUpdatedAt: Date.now(),
      isLoading: false,
      error: null,
    }),
  };
});
// tier: "premium" short-circuits MarketLimitUpgradePrompt's free-tier usage
// checks (it calls getUsage() unconditionally on every render, so the mock
// still needs a callable getUsage even though it's never exercised here).
vi.mock("@/lib/entitlements", () => ({
  useEntitlements: () => ({
    getAccess: () => ({ level: "full" }),
    canAccess: () => true,
    isMetricGated: () => false,
    tier: "premium",
    getUsage: () => null,
    incrementUsage: async () => true,
  }),
}));
// Self-fetching leaf that isn't part of this test's composition/state focus —
// it calls useQuery directly (bypassing the useMarketSnapshot mock above).
vi.mock("@/app/components/social-proof/SocialProofBadge", () => ({
  SocialProofBadge: () => <div data-testid="social-proof" />,
}));
// TourSpotlight reads the Next.js app router (useRouter/useSearchParams),
// which isn't mounted in this test environment. It's independently covered
// by its own test suite, so stub it here too.
vi.mock("@/app/tour/components/TourSpotlight", () => ({
  TourSpotlight: () => null,
}));
// Stub the leaf children so the test targets MarketDashboard's composition + state wiring.
vi.mock("../MarketHeadline", () => ({
  MarketHeadline: () => <div data-testid="headline" />,
}));
vi.mock("../components/MetricRail", () => ({
  MetricRail: ({
    selectedMetricId,
    onSelectMetric,
    metricIds,
  }: {
    selectedMetricId: string;
    onSelectMetric: (id: string) => void;
    metricIds: string[];
  }) => (
    <div data-testid="rail" data-selected={selectedMetricId}>
      {metricIds.map((id) => (
        <button key={id} onClick={() => onSelectMetric(id)}>
          {id}
        </button>
      ))}
    </div>
  ),
}));
vi.mock("../components/MarketPrimaryChart", () => ({
  MarketPrimaryChart: ({ metricId }: { metricId: string }) => (
    <div data-testid="chart" data-metric={metricId} />
  ),
}));

import { MarketDashboard } from "../MarketDashboard";

describe("MarketDashboard hybrid layout", () => {
  const props = {
    geographyId: "12420",
    geographyType: "metro" as const,
    userView: "investor" as const,
  };

  it("renders headline, chart, and rail", () => {
    render(<MarketDashboard {...props} />);
    expect(screen.getByTestId("headline")).toBeTruthy();
    expect(screen.getByTestId("chart")).toBeTruthy();
    expect(screen.getByTestId("rail")).toBeTruthy();
  });

  it("defaults the charted metric to home_value", () => {
    render(<MarketDashboard {...props} />);
    expect(screen.getByTestId("chart").getAttribute("data-metric")).toBe(
      "home_value",
    );
    expect(screen.getByTestId("rail").getAttribute("data-selected")).toBe(
      "home_value",
    );
  });

  it("switches the charted metric when a rail row is selected", () => {
    render(<MarketDashboard {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "rent_index" }));
    expect(screen.getByTestId("chart").getAttribute("data-metric")).toBe(
      "rent_index",
    );
  });
});
