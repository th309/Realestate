import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { KpiStrip } from "../KpiStrip";

// 8 months of data — long enough for the 6-month trend window (monthIndex=7
// compares against index 1) to have a real prior value to diff against.
const eightMonths = (start: number, step: number): (number | null)[] =>
  Array.from({ length: 8 }, (_, i) => start + i * step);

const baseKpiSeries = {
  price: eightMonths(400000, 2000),
  rent: eightMonths(1800, 5),
  inventory: eightMonths(10000, 100),
  dom: eightMonths(40, -0.25),
  score: eightMonths(55, 0.25),
  homeValueYoy: eightMonths(6, 0.1),
  unemployment: eightMonths(4, -0.05),
};

describe("KpiStrip", () => {
  it("renders the five KPI labels for a non-state scope", () => {
    render(
      <KpiStrip
        kpiSeries={baseKpiSeries}
        monthIndex={7}
        isStateScope={false}
      />,
    );
    [
      "Median value",
      "Median rent",
      "Active listings",
      "Days on mkt",
      "PIQ score",
    ].forEach((label) => expect(screen.getByText(label)).toBeTruthy());
  });

  it("swaps Median Rent -> Home Value YoY and PIQ Score -> Unemployment Rate for state scope — states have no rent_index coverage or native PropertyIQ score", () => {
    render(<KpiStrip kpiSeries={baseKpiSeries} monthIndex={7} isStateScope />);
    [
      "Median value",
      "Home value YoY",
      "Active listings",
      "Days on mkt",
      "Unemployment rate",
    ].forEach((label) => expect(screen.getByText(label)).toBeTruthy());
    expect(screen.queryByText("Median rent")).toBeNull();
    expect(screen.queryByText("PIQ score")).toBeNull();
  });

  it("suppresses delta badge when current value is null", () => {
    const kpiSeries = { ...baseKpiSeries, price: [...baseKpiSeries.price] };
    kpiSeries.price[7] = null;
    render(
      <KpiStrip kpiSeries={kpiSeries} monthIndex={7} isStateScope={false} />,
    );
    const medianValueLabel = screen.getByText("Median value");
    const priceCard = medianValueLabel.closest("div[style*='background']");
    expect(priceCard).toBeTruthy();
    const badgesInPriceCard = priceCard?.querySelectorAll(
      'span[style*="font-size: 11.5"]',
    );
    expect(badgesInPriceCard?.length).toBe(0);
  });

  it("suppresses delta badge when the value 6 months back is null", () => {
    const kpiSeries = { ...baseKpiSeries, price: [...baseKpiSeries.price] };
    kpiSeries.price[1] = null; // monthIndex 7 - 6 = 1
    render(
      <KpiStrip kpiSeries={kpiSeries} monthIndex={7} isStateScope={false} />,
    );
    const medianValueLabel = screen.getByText("Median value");
    const priceCard = medianValueLabel.closest("div[style*='background']");
    expect(priceCard).toBeTruthy();
    const badgesInPriceCard = priceCard?.querySelectorAll(
      'span[style*="font-size: 11.5"]',
    );
    expect(badgesInPriceCard?.length).toBe(0);
  });

  it("suppresses delta badge when monthIndex is under 6 (no prior period a full 6 months back)", () => {
    render(
      <KpiStrip
        kpiSeries={baseKpiSeries}
        monthIndex={5}
        isStateScope={false}
      />,
    );
    const badgeText = Array.from(document.querySelectorAll("span")).map(
      (el) => el.textContent,
    );
    expect(badgeText.some((text) => text?.includes("%"))).toBe(false);
  });

  it("colors an upward trend green with an up-triangle and a downward trend red with a down-triangle, with NO per-metric inversion — e.g. Days on Mkt rising (more days, worse) still reads as a plain 'up' badge, not a 'good/bad for this metric' judgment", () => {
    const rising = { ...baseKpiSeries, dom: [40, 40, 40, 40, 40, 40, 40, 50] };
    render(<KpiStrip kpiSeries={rising} monthIndex={7} isStateScope={false} />);
    const domLabelRising = screen.getByText("Days on mkt");
    const domCardRising = domLabelRising.closest("div[style*='background']")!;
    const upBadge = domCardRising.querySelector(
      'span[style*="font-size: 11.5"]',
    )!;
    expect(upBadge.textContent).toContain("▲");
    expect(upBadge.getAttribute("style")).toContain("var(--md-tertiary)");

    const falling = {
      ...baseKpiSeries,
      dom: [40, 40, 40, 40, 40, 40, 40, 30],
    };
    const { container: fallingContainer } = render(
      <KpiStrip kpiSeries={falling} monthIndex={7} isStateScope={false} />,
    );
    const domLabelFalling = within(fallingContainer).getByText("Days on mkt");
    const domCardFalling = domLabelFalling.closest("div[style*='background']")!;
    const downBadge = domCardFalling.querySelector(
      'span[style*="font-size: 11.5"]',
    )!;
    expect(downBadge.textContent).toContain("▼");
    expect(downBadge.getAttribute("style")).toContain("var(--md-error)");
  });
});
