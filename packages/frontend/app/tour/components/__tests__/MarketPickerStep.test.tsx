import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MarketPickerStep } from "../MarketPickerStep";

const setMarket = vi.fn();
vi.mock("../../TourStateProvider", () => ({
  useTour: () => ({ setMarket }),
}));

const useUniversalSearchMock = vi.fn();
vi.mock("@/app/shared/hooks/useUniversalSearch", () => ({
  useUniversalSearch: (...args: unknown[]) => useUniversalSearchMock(...args),
}));

vi.mock("@/lib/data", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/data")>("@/lib/data");
  return {
    ...actual,
    useScoreData: () => ({
      data: { scores: { propertyiq: { score: 87, grade: "A" } } },
      propertyiq: { score: 87, grade: "A" },
      isLoading: false,
    }),
  };
});

function defaultSearchState(overrides: Record<string, unknown> = {}) {
  return {
    searchQuery: "",
    setSearchQuery: vi.fn(),
    searchResults: [],
    searchLoading: false,
    showSearchResults: false,
    setShowSearchResults: vi.fn(),
    searchRef: { current: null },
    handleSearch: vi.fn(),
    clearSearch: vi.fn(),
    ...overrides,
  };
}

describe("MarketPickerStep", () => {
  beforeEach(() => {
    setMarket.mockReset();
    useUniversalSearchMock.mockReturnValue(defaultSearchState());
  });

  it("renders the search input + helper chips", () => {
    render(<MarketPickerStep />);
    expect(screen.getByRole("searchbox")).toBeInTheDocument();
    expect(screen.getAllByText(/Charlotte/).length).toBeGreaterThan(0);
    expect(screen.getByText(/skip/i)).toBeInTheDocument();
  });

  it("calls setMarket when a helper chip is clicked", () => {
    render(<MarketPickerStep />);
    fireEvent.click(screen.getByText(/^Charlotte/));
    expect(setMarket).toHaveBeenCalledWith(
      expect.objectContaining({ geoLevel: "metro", geoId: "16740" }),
    );
  });

  it("calls setMarket when a search suggestion is clicked", () => {
    useUniversalSearchMock.mockReturnValue(
      defaultSearchState({
        searchResults: [
          {
            id: "39580",
            name: "Raleigh-Cary, NC",
            type: "metro",
            subtitle: "Metropolitan Statistical Area",
          },
        ],
        showSearchResults: true,
      }),
    );
    render(<MarketPickerStep />);
    const opt = screen.getByRole("option");
    // The option renders a button — click it.
    const btn = opt.querySelector("button") ?? opt;
    fireEvent.click(btn);
    expect(setMarket).toHaveBeenCalledWith(
      expect.objectContaining({
        geoLevel: "metro",
        geoId: "39580",
        name: "Raleigh-Cary, NC",
      }),
    );
  });

  it("filters out state-typed results from the listbox (MarketRef has no 'state' geoLevel)", () => {
    useUniversalSearchMock.mockReturnValue(
      defaultSearchState({
        searchResults: [
          {
            id: "06",
            name: "California",
            type: "state",
            subtitle: "State",
          },
          {
            id: "39580",
            name: "Raleigh-Cary, NC",
            type: "metro",
            subtitle: "Metropolitan Statistical Area",
          },
        ],
        showSearchResults: true,
      }),
    );
    render(<MarketPickerStep />);
    // Only the metro result should render — state must be filtered out.
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(screen.queryByText("California")).not.toBeInTheDocument();
    expect(screen.getByText("Raleigh-Cary, NC")).toBeInTheDocument();
  });
});
