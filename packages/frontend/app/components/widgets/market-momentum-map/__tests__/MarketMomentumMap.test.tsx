import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseScoreHeatmap = vi.fn();
vi.mock("@/lib/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data")>();
  return {
    ...actual,
    useScoreHeatmap: (...args: unknown[]) => mockUseScoreHeatmap(...args),
  };
});
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { MarketMomentumMap } from "../MarketMomentumMap";

const payload = {
  months: ["2026-04-30", "2026-05-31"],
  metros: [
    {
      id: "19780",
      name: "Des Moines-West Des Moines, IA",
      lat: 41.512,
      lon: -93.729,
      pop: 737164,
      conf: "A",
    },
  ],
  scores: [[55, 57]],
};

describe("MarketMomentumMap", () => {
  beforeEach(() => {
    mockUseScoreHeatmap.mockReset();
    // useUsStatesBasemap fetches /geojson/states.json — stub fetch in jsdom
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ type: "FeatureCollection", features: [] }),
      }),
    );
  });

  it("shows the skeleton with the COVERAGE_COPY floor while loading", () => {
    mockUseScoreHeatmap.mockReturnValue({
      data: null,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    });
    render(<MarketMomentumMap />);
    expect(screen.getByTestId("momentum-map-skeleton").textContent).toContain(
      "900+",
    );
  });

  it("shows a retry button on error", () => {
    const refetch = vi.fn();
    mockUseScoreHeatmap.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      refetch,
    });
    render(<MarketMomentumMap />);
    screen.getByRole("button", { name: /retry/i }).click();
    expect(refetch).toHaveBeenCalled();
  });

  it("renders header, dots, timeline, summary strip and payload-derived footnote in hero size", () => {
    mockUseScoreHeatmap.mockReturnValue({
      data: payload,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    const { container } = render(<MarketMomentumMap size="hero" />);
    expect(screen.getByTestId("momentum-map-hero")).toBeTruthy();
    expect(screen.getByTestId("momentum-month-readout").textContent).toBe(
      "May 2026",
    );
    expect(container.querySelectorAll("circle").length).toBe(1);
    expect(screen.getByTestId("momentum-summary-strip")).toBeTruthy();
    // Footnote count comes from the payload, not a hardcoded constant
    expect(screen.getByText(/1 metros scored monthly/)).toBeTruthy();
  });

  it("omits the summary strip in card size", () => {
    mockUseScoreHeatmap.mockReturnValue({
      data: payload,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(<MarketMomentumMap size="card" />);
    expect(screen.getByTestId("momentum-map-card")).toBeTruthy();
    expect(screen.queryByTestId("momentum-summary-strip")).toBeNull();
  });
});
