import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ComponentProps, ReactNode } from "react";
import { render, screen } from "@testing-library/react";

const useSavedAnalysis = vi.fn();
vi.mock("@/lib/analyzer/useSavedAnalysis", () => ({
  useSavedAnalysis: (id: string) => useSavedAnalysis(id),
}));

/** next/link stand-in: href is whatever the caller passed, not necessarily a string. */
type LinkMockProps = Omit<ComponentProps<"a">, "href"> & {
  href?: unknown;
  children?: ReactNode;
};
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: LinkMockProps) => (
    <a href={typeof href === "string" ? href : ""} {...rest}>
      {children}
    </a>
  ),
}));

// The live analyzer is a whole page's worth of hooks (RentCast, market
// context, entitlements). This test is about what the loader HANDS it.
vi.mock("../../../AnalyzerClient", () => ({
  default: ({
    dealId,
    initialState,
  }: {
    dealId?: string;
    initialState?: { label?: string | null; address?: string };
  }) => (
    <div
      data-testid="analyzer"
      data-deal-id={dealId}
      data-label={initialState?.label ?? ""}
      data-address={initialState?.address ?? ""}
    />
  ),
}));

import SavedDealLoader from "../SavedDealLoader";

const ROW = {
  id: "row-1",
  label: "Duplex deal",
  address_full: "1 A St",
  address_city: "Austin",
  address_state: "TX",
  address_zip: "78701",
  updated_at: "2026-05-01T00:00:00.000Z",
  input_snapshot: { price: 250000 },
  result_snapshot: {},
  market_context: null,
};

describe("SavedDealLoader hands a hydrated state to the editable analyzer", () => {
  beforeEach(() => useSavedAnalysis.mockReset());

  it("shows a loading state with a way back while fetching", () => {
    useSavedAnalysis.mockReturnValue({ data: undefined, isLoading: true });
    render(<SavedDealLoader id="row-1" />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /back to analyzer/i }),
    ).toHaveAttribute("href", "/analyzer");
  });

  it("shows not-found with a way back when the row is missing", () => {
    useSavedAnalysis.mockReturnValue({ data: null, isLoading: false });
    render(<SavedDealLoader id="row-9" />);
    expect(screen.getByText(/not found/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /back to analyzer/i }),
    ).toHaveAttribute("href", "/analyzer");
  });

  it("renders the editable analyzer seeded from the migrated row", () => {
    useSavedAnalysis.mockReturnValue({ data: ROW, isLoading: false });
    render(<SavedDealLoader id="row-1" />);
    const el = screen.getByTestId("analyzer");
    expect(el).toHaveAttribute("data-deal-id", "row-1");
    expect(el).toHaveAttribute("data-label", "Duplex deal");
    // Proves the row went through migrateDealState rather than being handed
    // over raw — `address` is harvested from the legacy `address_full`.
    expect(el).toHaveAttribute("data-address", "1 A St");
  });

  it("opens a corrupt row as an analyzer rather than crashing", () => {
    useSavedAnalysis.mockReturnValue({
      data: { id: "row-2", input_snapshot: "not-an-object" },
      isLoading: false,
    });
    render(<SavedDealLoader id="row-2" />);
    expect(screen.getByTestId("analyzer")).toHaveAttribute(
      "data-deal-id",
      "row-2",
    );
  });
});
