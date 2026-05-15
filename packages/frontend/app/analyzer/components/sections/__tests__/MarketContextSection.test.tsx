import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MarketContextSection } from "../MarketContextSection";

describe("MarketContextSection", () => {
  it("renders PIQ ring + 4 stat cards when data present", () => {
    const { container, getByText } = render(
      <MarketContextSection
        piqScore={82}
        piqLabel="GREAT"
        homeValue={425_000}
        rentIndex={2950}
        marketHeat={8.2}
        netMigration={2100}
      />,
    );
    expect(getByText("Market Context")).toBeTruthy();
    expect(container.querySelector("[data-piq-tile] svg")).toBeTruthy();
    expect(container.querySelectorAll("[data-stat-card]").length).toBe(4);
    expect(getByText("$425K")).toBeTruthy();
    expect(getByText("2,950")).toBeTruthy();
    expect(getByText("8.2")).toBeTruthy();
    expect(getByText("2,100")).toBeTruthy();
  });

  it("renders 'PIQ Score unavailable' when score null", () => {
    const { getByText } = render(
      <MarketContextSection
        piqScore={null}
        homeValue={null}
        rentIndex={null}
        marketHeat={null}
        netMigration={null}
      />,
    );
    expect(getByText(/PIQ Score unavailable/)).toBeTruthy();
  });
});
