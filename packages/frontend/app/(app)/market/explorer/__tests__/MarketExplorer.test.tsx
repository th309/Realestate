import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../lib/useExplorerScopeData", () => ({
  MAX_MONTHS: 120,
  useExplorerScopeData: vi.fn(),
}));
vi.mock("../lib/useGeoBoundaries", () => ({
  useGeoBoundaries: vi.fn(() => ({
    parentOutline: null,
    viewBoxWidth: 400,
    viewBoxHeight: 300,
    features: [
      { id: "35620", path: "M0,0L10,0L10,10L0,10Z" },
      { id: "31080", path: "M20,0L30,0L30,10L20,10Z" },
    ],
    isLoading: false,
    error: null,
  })),
}));

import { useExplorerScopeData } from "../lib/useExplorerScopeData";
import { useGeoBoundaries } from "../lib/useGeoBoundaries";
import MarketExplorer from "../MarketExplorer";

const mockUseExplorerScopeData = vi.mocked(useExplorerScopeData);
const mockUseGeoBoundaries = vi.mocked(useGeoBoundaries);

const TWO_MONTH_SCOPE = {
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
  totalAvailable: undefined,
  isLoading: false,
  error: null,
};

beforeEach(() => {
  mockUseExplorerScopeData.mockReturnValue(TWO_MONTH_SCOPE);
});

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

  it("defaults to the latest month with a real PropertyIQ score, not the raw latest date", () => {
    // Simulates Zillow (home_value/rent_index/propertyiq_score) publishing a
    // month behind Realtor.com-sourced metrics (for_sale_inventory,
    // days_on_market, hotness_score, new_listings, home_sales): the raw date
    // union's last month (2026-06) has real Realtor data but a null score for
    // every region, while 2026-05 has a real score.
    mockUseExplorerScopeData.mockReturnValue({
      dates: ["2026-04-01", "2026-05-01", "2026-06-01"],
      regions: [
        { id: "35620", name: "New York", state: "NY", population: 20000000 },
      ],
      series: {
        home_value: { "35620": [680000, 690000, 695000] },
        rent_index: { "35620": [3000, 3050, null] },
        for_sale_inventory: { "35620": [30000, 31000, 31500] },
        days_on_market: { "35620": [45, 44, 43] },
        hotness_score: { "35620": [78, 79, 80] },
        new_listings: { "35620": [9000, 9100, 9200] },
        home_sales: { "35620": [8000, 8100, 8200] },
        propertyiq_score: { "35620": [72, 74, null] },
      },
      totalAvailable: undefined,
      isLoading: false,
      error: null,
    });

    render(<MarketExplorer />);

    // Landing on 2026-05 (score 74) means the rail renders a real gauge;
    // landing on the raw-latest 2026-06 (score null) would show the
    // "Score unavailable" placeholder instead.
    expect(
      screen.getByRole("img", { name: /PropertyIQ Score 74/i }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("img", { name: /Score unavailable/i }),
    ).toBeNull();
  });

  it("hides the dashboard CTA at state scope (states have no per-state dashboard page)", () => {
    render(<MarketExplorer />);
    // The "State" level tab, not the Bubbles/Map quick toggle — toggling Map
    // alone must keep the current root level (e.g. stay on Metro) rather
    // than forcing state scope; only the level tab actually switches level.
    fireEvent.click(screen.getByText("State"));
    expect(
      screen.queryByRole("button", { name: /Open full market dashboard/i }),
    ).toBeNull();
  });

  it("surfaces an error message when the scope data hook returns an error", () => {
    mockUseExplorerScopeData.mockReturnValue({
      dates: [],
      regions: [],
      series: {},
      totalAvailable: undefined,
      isLoading: false,
      error: new Error("network down"),
    });
    render(<MarketExplorer />);
    expect(
      screen.getByText(/Something went wrong loading this scope/i),
    ).toBeTruthy();
  });

  it("drilling into a metro then toggling Map view shows that metro's own boundaries, not the national state grid", () => {
    render(<MarketExplorer />);
    const titleEl = Array.from(document.querySelectorAll("circle title")).find(
      (el) => el.textContent?.includes("New York"),
    );
    fireEvent.doubleClick(titleEl!.parentElement!); // drill metro -> county
    fireEvent.click(screen.getByText("Map"));
    // Before the SET_VIEW fix, this would reset path to [] and re-render the
    // national state grid via useGeoBoundaries("state", ...) instead of
    // staying scoped to New York's counties.
    expect(mockUseGeoBoundaries).toHaveBeenLastCalledWith(
      "county",
      "metro",
      "35620",
      undefined,
      expect.any(Array),
    );
  });

  it('the "State" level tab still jumps to the national tile map from any depth', () => {
    render(<MarketExplorer />);
    const titleEl = Array.from(document.querySelectorAll("circle title")).find(
      (el) => el.textContent?.includes("New York"),
    );
    fireEvent.doubleClick(titleEl!.parentElement!);
    fireEvent.click(screen.getByText("State")); // level tab, not the Map toggle
    expect(mockUseGeoBoundaries).toHaveBeenLastCalledWith(
      "state",
      undefined,
      undefined,
      undefined,
      expect.any(Array),
    );
  });

  it("the \"ZIP\" level tab jumps straight into the selected county's ZIPs from a metro's county view, without a second drill-in click", () => {
    render(<MarketExplorer />);
    const titleEl = Array.from(document.querySelectorAll("circle title")).find(
      (el) => el.textContent?.includes("New York"),
    );
    fireEvent.doubleClick(titleEl!.parentElement!); // metro -> county; New York is auto-selected

    fireEvent.click(screen.getByText("ZIP")); // level tab, not a second bubble drill

    expect(mockUseGeoBoundaries).toHaveBeenLastCalledWith(
      "zip",
      "county",
      "35620",
      "NY",
      expect.any(Array),
    );
  });
});
