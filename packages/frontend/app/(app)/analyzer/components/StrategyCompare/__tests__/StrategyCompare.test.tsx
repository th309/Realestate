import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { StrategyCompare } from "../StrategyCompare";

beforeEach(() => {
  localStorage.clear();
});

const cards = [
  {
    id: "buyAndHold" as const,
    title: "Buy & Hold",
    heroMetric: { label: "Cap Rate", value: "8.2%" },
    stats: [],
  },
  {
    id: "flip" as const,
    title: "Flip",
    heroMetric: { label: "ROI", value: "22%" },
    stats: [],
  },
  {
    id: "brrrr" as const,
    title: "BRRRR",
    heroMetric: { label: "Score", value: "85" },
    stats: [],
  },
];

const fullViews = {
  buyAndHold: <div>BAH FULL</div>,
  flip: <div>FLIP FULL</div>,
  brrrr: <div>BRRRR FULL</div>,
};

const summaries = [
  {
    key: "buyAndHold" as const,
    title: "Buy & Hold",
    heroLabel: "Cap Rate",
    heroValue: "8.2%",
    full: <div>BAH FULL S</div>,
    summary: [],
  },
  {
    key: "flip" as const,
    title: "Flip",
    heroLabel: "ROI",
    heroValue: "22%",
    full: <div>FLIP FULL S</div>,
    summary: [],
  },
  {
    key: "brrrr" as const,
    title: "BRRRR",
    heroLabel: "Score",
    heroValue: "85",
    full: <div>BRRRR FULL S</div>,
    summary: [],
  },
];

const scores = {
  buyAndHold: { irr10: 0.1, cashflowMonthly: 200 },
  flip: { roiPct: 25, projectedProfit: 50_000 },
  brrrr: { score: 85, postRefiCashflow: 300 },
};

describe("StrategyCompare", () => {
  it("default view is grid3", () => {
    const { container } = render(
      <StrategyCompare
        scores={scores}
        cards={cards}
        fullViews={fullViews}
        summaries={summaries}
      />,
    );
    expect(
      container
        .querySelector("[data-strategy-body]")
        ?.getAttribute("data-view"),
    ).toBe("grid3");
    expect(container.querySelectorAll("[data-strategy-card]").length).toBe(3);
  });

  it("switching to tabs view renders SingleStrategyTab", () => {
    const { container, getByText } = render(
      <StrategyCompare
        scores={scores}
        cards={cards}
        fullViews={fullViews}
        summaries={summaries}
      />,
    );
    fireEvent.click(container.querySelector("[data-view-option='tabs']")!);
    expect(
      container
        .querySelector("[data-strategy-body]")
        ?.getAttribute("data-view"),
    ).toBe("tabs");
    expect(getByText("BAH FULL")).toBeTruthy();
  });

  it("switching to winner view renders WinnerPlusOthers with picked winner", () => {
    const { container, getByText } = render(
      <StrategyCompare
        scores={scores}
        cards={cards}
        fullViews={fullViews}
        summaries={summaries}
      />,
    );
    fireEvent.click(container.querySelector("[data-view-option='winner']")!);
    // brrrr wins (score 85 + postRefiCashflow > 0)
    expect(
      container.querySelector("[data-strategy-full='brrrr']"),
    ).toBeTruthy();
  });

  it("BestPlayCallout always rendered", () => {
    const { container } = render(
      <StrategyCompare
        scores={scores}
        cards={cards}
        fullViews={fullViews}
        summaries={summaries}
      />,
    );
    expect(container.querySelector("[data-best-play]")).toBeTruthy();
  });
});
