import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MarketComparisonView } from "../MarketComparisonView";

let currentParams = "";
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(currentParams),
}));

vi.mock("@/lib/data", () => ({
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
  it("renders 'Pick a market first' when no market query param", () => {
    currentParams = "";
    render(<MarketComparisonView />);
    expect(screen.getByText(/pick a market/i)).toBeInTheDocument();
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
    // getScoreLabel(65) === "FAIR" per CLAUDE.md §9; rendered as "PropertyIQ 65 · FAIR".
    expect(screen.getAllByText(/PropertyIQ 65 · FAIR/i).length).toBeGreaterThan(
      0,
    );
  });

  it("renders 'one-of-a-kind' when no peers", async () => {
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
      expect(screen.getByText(/one-of-a-kind/i)).toBeInTheDocument();
    });
  });
});
