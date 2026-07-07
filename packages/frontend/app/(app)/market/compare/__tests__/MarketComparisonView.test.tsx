import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MarketComparisonView } from "../MarketComparisonView";

let currentParams = "";
const pushSpy = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(currentParams),
  useRouter: () => ({ push: pushSpy }),
}));

// The view now gates on entitlements; a Pro tier exercises the unlocked tool
// path these tests assert on (free tier would render the paywall instead).
vi.mock("@/lib/entitlements", () => ({
  useEntitlements: () => ({ tier: "pro", loading: false }),
}));

// Stub the search box so this test doesn't pull in the live universal-search hook.
vi.mock("../PeerSearchBox", () => ({
  PeerSearchBox: ({ placeholder }: { placeholder: string }) => (
    <div data-testid="peer-search">{placeholder}</div>
  ),
}));

vi.mock("@/lib/data", () => ({
  formatGeoDisplayName: (name?: string) => name ?? "",
  fetchPeers: vi.fn(async () => ({
    source: { geoLevel: "metro", geoId: "39580", name: "Charlotte", score: 65 },
    peers: [
      {
        geoLevel: "metro",
        geoId: "16740",
        name: "Charlotte-Concord",
        score: 64,
        householdCount: 100000,
      },
    ],
  })),
  useScoreData: () => ({
    data: {
      location_id: "39580",
      location_name: "Charlotte",
      geography: "metro",
      median_price: 400000,
      score_date: "2026-04-01",
      scores: {
        propertyiq: {
          score: 65,
          grade: "B",
          confidence: 0.8,
          confidence_level: "high",
        },
      },
    },
    propertyiq: null,
    isLoading: false,
  }),
  useDataCard: () => ({ formattedValue: "$400K", isLoading: false }),
}));

describe("MarketComparisonView", () => {
  it("offers a market picker instead of dead-ending when no market query param", () => {
    currentParams = "";
    render(<MarketComparisonView />);
    expect(screen.getByText(/compare markets/i)).toBeInTheDocument();
    expect(screen.getByTestId("peer-search")).toBeInTheDocument();
  });

  it("fetches peers and renders the comparison grid", async () => {
    currentParams = "market=metro-39580";
    render(<MarketComparisonView />);
    await waitFor(() => {
      expect(
        screen.getByText(/how your market stacks up/i),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("VS")).toBeInTheDocument();
    // Verify we render the real ScoreResponse path (location_name, score, label)
    // rather than silently falling back to "metro/16740" + "—".
    expect(screen.getAllByText("Charlotte").length).toBeGreaterThan(0);
    // getScoreLabel(65) === "FIRMING" per CLAUDE.md §9; rendered as "PropertyIQ 65 · FIRMING".
    expect(
      screen.getAllByText(/PropertyIQ 65 · FIRMING/i).length,
    ).toBeGreaterThan(0);
    // The peer-override search is offered alongside the grid.
    expect(screen.getByTestId("peer-search")).toBeInTheDocument();
  });

  it("shows a search fallback (not a dead-end) when no peer is found", async () => {
    const { fetchPeers } = await import("@/lib/data");
    (fetchPeers as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      source: {
        geoLevel: "metro",
        geoId: "39580",
        name: "Charlotte",
        score: 65,
      },
      peers: [],
    });
    currentParams = "market=metro-39580";
    render(<MarketComparisonView />);
    await waitFor(() => {
      expect(screen.getByText(/no peer found nearby/i)).toBeInTheDocument();
    });
  });
});
