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
    data: { score: 65, label: "FAIR", geoName: "Charlotte" },
    propertyiq: null,
    isLoading: false,
  }),
  useDataCard: () => ({ formattedValue: "$400K", isLoading: false }),
}));

vi.mock("@/app/tour/components/TourSpotlight", () => ({
  TourSpotlight: (props: { stepId: string }) => (
    <div data-testid="tour-spotlight" data-step={props.stepId} />
  ),
}));

describe("MarketComparisonView", () => {
  it("renders 'Pick a market first' when no market query param", () => {
    currentParams = "";
    render(<MarketComparisonView />);
    expect(screen.getByText(/pick a market/i)).toBeInTheDocument();
  });

  it("fetches peers and renders the comparison grid + step3 spotlight", async () => {
    currentParams = "market=metro-39580&tour=step3";
    render(<MarketComparisonView />);
    await waitFor(() => {
      expect(screen.getByTestId("tour-spotlight")).toBeInTheDocument();
    });
    expect(screen.getByTestId("tour-spotlight").getAttribute("data-step")).toBe(
      "step3",
    );
    expect(screen.getByText(/how your market stacks up/i)).toBeInTheDocument();
    expect(screen.getByText("VS")).toBeInTheDocument();
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
    currentParams = "market=metro-39580&tour=step3";
    render(<MarketComparisonView />);
    await waitFor(() => {
      expect(screen.getByText(/one-of-a-kind/i)).toBeInTheDocument();
    });
  });
});
