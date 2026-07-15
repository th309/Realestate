import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { KpiStrip } from "../KpiStrip";

describe("KpiStrip", () => {
  it("renders the five KPI labels", () => {
    const agg = {
      price: [400000, 420000],
      rent: [1800, 1850],
      inventory: [10000, 11000],
      dom: [40, 38],
      score: [55, 57],
    };
    render(<KpiStrip agg={agg} monthIndex={1} windowStart={0} />);
    [
      "Median value",
      "Median rent",
      "Active listings",
      "Avg days on mkt",
      "Avg PIQ score",
    ].forEach((label) => expect(screen.getByText(label)).toBeTruthy());
  });

  it("suppresses delta badge when current value is null", () => {
    const agg = {
      price: [400000, null],
      rent: [1800, 1850],
      inventory: [10000, 11000],
      dom: [40, 38],
      score: [55, 57],
    };
    const { container } = render(
      <KpiStrip agg={agg} monthIndex={1} windowStart={0} />
    );
    const medianValueLabel = screen.getByText("Median value");
    const priceCard = medianValueLabel.closest("div[style*='background']");
    expect(priceCard).toBeTruthy();
    const badgesInPriceCard = priceCard?.querySelectorAll(
      'span[style*="font-size: 11.5"]'
    );
    expect(badgesInPriceCard?.length).toBe(0);
  });

  it("suppresses delta badge when previous value is null", () => {
    const agg = {
      price: [null, 420000],
      rent: [1800, 1850],
      inventory: [10000, 11000],
      dom: [40, 38],
      score: [55, 57],
    };
    const { container } = render(
      <KpiStrip agg={agg} monthIndex={1} windowStart={0} />
    );
    const medianValueLabel = screen.getByText("Median value");
    const priceCard = medianValueLabel.closest("div[style*='background']");
    expect(priceCard).toBeTruthy();
    const badgesInPriceCard = priceCard?.querySelectorAll(
      'span[style*="font-size: 11.5"]'
    );
    expect(badgesInPriceCard?.length).toBe(0);
  });

  it("suppresses delta badge when monthIndex is 0 (no prior period)", () => {
    const agg = {
      price: [400000, 420000],
      rent: [1800, 1850],
      inventory: [10000, 11000],
      dom: [40, 38],
      score: [55, 57],
    };
    render(<KpiStrip agg={agg} monthIndex={0} windowStart={0} />);
    const badgeText = Array.from(document.querySelectorAll("span")).map(
      (el) => el.textContent
    );
    expect(badgeText.some((text) => text?.includes("0.0%"))).toBe(false);
  });
});
