import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../lib/useExplorerScopeData", () => ({
  MAX_MONTHS: 120,
  useExplorerScopeData: () => ({
    dates: ["2026-04-01", "2026-05-01"],
    regions: [
      { id: "35620", name: "New York", state: "NY", population: 20000000 },
      { id: "31080", name: "Los Angeles", state: "CA", population: 13000000 },
    ],
    series: {
      home_value: { "35620": [680000, 690000], "31080": [950000, 960000] },
      rent_index: { "35620": [3000, 3050], "31080": [3400, 3450] },
      for_sale_inventory: { "35620": [30000, 31000], "31080": [15000, 15500] },
      days_on_market: { "35620": [45, 44], "31080": [42, 41] },
      hotness_score: { "35620": [78, 79], "31080": [71, 72] },
      new_listings: { "35620": [9000, 9100], "31080": [5000, 5100] },
      home_sales: { "35620": [8000, 8100], "31080": [4600, 4700] },
      propertyiq_score: { "35620": [72, 74], "31080": [58, 60] },
    },
    isLoading: false,
    error: null,
  }),
}));

import MarketExplorer from "../MarketExplorer";

describe("MarketExplorer", () => {
  it("renders the explorer with hero, metric switcher, and leaderboard", () => {
    render(<MarketExplorer />);
    expect(screen.getByText("Market Explorer")).toBeTruthy();
    expect(screen.getByText("PropertyIQ Score")).toBeTruthy(); // metric chip
    expect(screen.getByText(/Rankings/)).toBeTruthy();
    expect(screen.getAllByText("New York").length).toBeGreaterThan(0);
  });

  it("does not drill past ZIP scope when double-clicking a bubble at ZIP scope", () => {
    const { container } = render(<MarketExplorer />);
    // BubbleChart redraws the selected bubble last (so it sits on top), so DOM
    // order isn't stable across drills — target the "New York" bubble via its
    // <title> child's text content instead of relying on element order.
    const drillNewYork = () => {
      const titleEl = Array.from(
        container.querySelectorAll("circle title"),
      ).find((el) => el.textContent?.includes("New York"));
      expect(titleEl).toBeTruthy();
      fireEvent.doubleClick(titleEl!.parentElement!);
    };

    drillNewYork(); // metro -> county
    drillNewYork(); // county -> zip
    const crumbsAtZipScope = screen.getAllByText("New York").length;

    // Attempting to drill again while already at ZIP scope must be a no-op:
    // there is no level below ZIP, so this must not push another breadcrumb.
    drillNewYork();
    expect(screen.getAllByText("New York").length).toBe(crumbsAtZipScope);
  });
});
