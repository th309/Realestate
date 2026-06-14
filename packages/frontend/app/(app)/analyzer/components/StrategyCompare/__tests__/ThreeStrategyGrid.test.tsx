import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { ThreeStrategyGrid } from "../ThreeStrategyGrid";

const sample = [
  {
    id: "buyAndHold" as const,
    title: "Buy & Hold",
    heroMetric: { label: "Cap Rate", value: "8.2%" },
    stats: [
      { label: "Cashflow", value: "$642/mo" },
      { label: "IRR (10y)", value: "12.4%" },
    ],
  },
  {
    id: "flip" as const,
    title: "Flip",
    heroMetric: { label: "ROI", value: "22.4%" },
    stats: [{ label: "Profit", value: "$48K" }],
  },
  {
    id: "brrrr" as const,
    title: "BRRRR",
    heroMetric: { label: "Score", value: "85" },
    stats: [{ label: "Cash left", value: "$8K" }],
    isWinner: true,
  },
];

describe("ThreeStrategyGrid", () => {
  it("renders 3 cards", () => {
    const { container } = render(<ThreeStrategyGrid strategies={sample} />);
    expect(container.querySelectorAll("[data-strategy-card]").length).toBe(3);
  });

  it("renders titles + hero metrics + stats", () => {
    const { getByText } = render(<ThreeStrategyGrid strategies={sample} />);
    expect(getByText("Buy & Hold")).toBeTruthy();
    expect(getByText("8.2%")).toBeTruthy();
    expect(getByText("$642/mo")).toBeTruthy();
  });

  it("winner card shows badge + tertiary border", () => {
    const { container } = render(<ThreeStrategyGrid strategies={sample} />);
    const brrrrCard = container.querySelector("[data-strategy-card='brrrr']");
    expect(brrrrCard?.querySelector("[data-winner-badge]")).toBeTruthy();
    expect(brrrrCard?.className).toMatch(/tertiary/);
  });

  it("clicking a card calls onClick", () => {
    const onClick = vi.fn();
    const { container } = render(
      <ThreeStrategyGrid strategies={[{ ...sample[0], onClick }]} />,
    );
    fireEvent.click(
      container.querySelector("[data-strategy-card='buyAndHold']")!,
    );
    expect(onClick).toHaveBeenCalled();
  });
});
