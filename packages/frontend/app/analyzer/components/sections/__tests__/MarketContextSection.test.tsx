import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";

// Mock @/lib/data so useDataCard returns a static null shape without needing
// a QueryClientProvider — the section's behavior under test is pill switching
// + fallback-vs-live value resolution, not the actual network round trip.
vi.mock("@/lib/data", () => ({
  useDataCard: () => ({
    value: null,
    formattedValue: "—",
    percentChange: null,
    direction: null,
    sparklineData: [],
    trend: null,
    isLoading: false,
    isSnapshotLoading: false,
    isTrendLoading: false,
    error: null,
    gated: false,
  }),
}));

import { MarketContextSection } from "../MarketContextSection";

const FULL_CHAIN = {
  zip: "78704",
  county_fips: "48453",
  cbsa_code: "12420",
  state: "48",
};

describe("MarketContextSection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders 5 metric tiles", () => {
    const { container } = render(
      <MarketContextSection
        chain={FULL_CHAIN}
        initialGeoLevel="zip"
        fallbackPiq={73}
        fallbackHomeValue={425_000}
        fallbackRentIndex={2_950}
        fallbackMarketHeat={62}
        fallbackNetMigration={2_100}
      />,
    );
    expect(container.querySelectorAll("[data-metric-block]").length).toBe(5);
  });

  it("renders all three geo pills when chain has all levels, defaulting to Metro", () => {
    const { getAllByRole, getByRole } = render(
      <MarketContextSection
        chain={FULL_CHAIN}
        initialGeoLevel="zip"
        fallbackPiq={null}
        fallbackHomeValue={null}
        fallbackRentIndex={null}
        fallbackMarketHeat={null}
        fallbackNetMigration={null}
      />,
    );
    const tabs = getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Metro", "County", "ZIP"]);
    expect(
      getByRole("tab", { name: "Metro" }).getAttribute("aria-selected"),
    ).toBe("true");
  });

  it("hides the Metro pill for unmetropolitan ZIPs", () => {
    const { getAllByRole } = render(
      <MarketContextSection
        chain={{ zip: "59001", county_fips: "30009", state: "30" }}
        initialGeoLevel="zip"
        fallbackPiq={null}
        fallbackHomeValue={null}
        fallbackRentIndex={null}
        fallbackMarketHeat={null}
        fallbackNetMigration={null}
      />,
    );
    const labels = getAllByRole("tab").map((t) => t.textContent);
    expect(labels).toEqual(["County", "ZIP"]);
  });

  it("switches active pill on click and updates aria-selected", () => {
    const { getByRole } = render(
      <MarketContextSection
        chain={FULL_CHAIN}
        initialGeoLevel="zip"
        fallbackPiq={null}
        fallbackHomeValue={null}
        fallbackRentIndex={null}
        fallbackMarketHeat={null}
        fallbackNetMigration={null}
      />,
    );
    const zipPill = getByRole("tab", { name: "ZIP" });
    fireEvent.click(zipPill);
    expect(zipPill.getAttribute("aria-selected")).toBe("true");
    expect(
      getByRole("tab", { name: "Metro" }).getAttribute("aria-selected"),
    ).toBe("false");
  });

  it("suppresses pills entirely when chain is null (saved/shared snapshot path)", () => {
    const { queryByRole } = render(
      <MarketContextSection
        chain={null}
        initialGeoLevel={null}
        fallbackPiq={73}
        fallbackHomeValue={425_000}
        fallbackRentIndex={2_950}
        fallbackMarketHeat={62}
        fallbackNetMigration={2_100}
      />,
    );
    expect(queryByRole("tablist")).toBeNull();
  });

  it("renders fallback snapshot values when useDataCard returns null", () => {
    const { container } = render(
      <MarketContextSection
        chain={null}
        initialGeoLevel={null}
        fallbackPiq={73}
        fallbackHomeValue={425_000}
        fallbackRentIndex={2_950}
        fallbackMarketHeat={62}
        fallbackNetMigration={2_100}
      />,
    );
    // PIQ tile (variant=score, decimals=0)
    const piqBlock = container.querySelector("[data-metric-block]");
    expect(piqBlock?.textContent).toContain("73");
    // Home Value (currency)
    expect(container.textContent).toContain("$425,000");
  });
});
