import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { DealGradingResult, Letter } from "@propertyiq/analyzer-core";
import { RecommendationCard } from "../RecommendationCard";

function makeResult(
  overrides: Partial<DealGradingResult> = {},
): DealGradingResult {
  return {
    letter: "B",
    label: "Buy",
    summary: "Solid CoC, DSCR is the watch-item.",
    rawGpa: 2.85,
    marketAdjustment: 0,
    finalGpa: 2.85,
    metrics: [],
    advisories: [],
    autoKills: [],
    ...overrides,
  };
}

const LABELS: Record<Letter, string> = {
  A: "Strong Buy",
  B: "Buy",
  C: "Marginal",
  D: "Pass",
  F: "Avoid",
};

describe("RecommendationCard", () => {
  for (const letter of ["A", "B", "C", "D", "F"] as Letter[]) {
    it(`renders for letter ${letter}`, () => {
      const result = makeResult({ letter, label: LABELS[letter] });
      const { container, getByText } = render(
        <RecommendationCard result={result} />,
      );
      expect(getByText(LABELS[letter])).toBeTruthy();
      const letterEl = container.querySelector(
        "[data-grade-letter]",
      ) as HTMLElement;
      expect(letterEl).toBeTruthy();
      const aria = letterEl.getAttribute("aria-label") ?? "";
      expect(aria).toContain(`Grade ${letter}`);
      expect(aria).toContain(LABELS[letter]);
    });
  }

  it("renders flooredAt pill when set", () => {
    const { container, getByText } = render(
      <RecommendationCard result={makeResult({ flooredAt: "D" })} />,
    );
    expect(container.querySelector('[data-meta-pill="floored"]')).toBeTruthy();
    expect(getByText(/Floored at D/)).toBeTruthy();
  });

  it("does not render flooredAt pill when unset", () => {
    const { container } = render(<RecommendationCard result={makeResult()} />);
    expect(container.querySelector('[data-meta-pill="floored"]')).toBeNull();
  });

  it("renders summary text", () => {
    const { getByText } = render(
      <RecommendationCard
        result={makeResult({ summary: "Watch the DSCR closely." })}
      />,
    );
    expect(getByText("Watch the DSCR closely.")).toBeTruthy();
  });

  it("renders the graded-against label even without a customize callback", () => {
    const { container, getByText } = render(
      <RecommendationCard result={makeResult()} presetLabel="Aggressive" />,
    );
    expect(getByText("Graded against Aggressive criteria")).toBeTruthy();
    expect(
      container.querySelector('[data-meta-pill="customize"]'),
    ).toBeTruthy();
  });

  it("does not render the Edit criteria button when onCustomizeClick is absent", () => {
    render(<RecommendationCard result={makeResult()} />);
    expect(screen.queryByTestId("grade-edit-criteria")).toBeNull();
  });

  it("renders an Edit criteria button that fires onCustomizeClick when provided", () => {
    const onCustomizeClick = vi.fn();
    render(
      <RecommendationCard
        result={makeResult()}
        onCustomizeClick={onCustomizeClick}
      />,
    );
    const btn = screen.getByTestId("grade-edit-criteria");
    expect(btn.textContent).toBe("Edit criteria");
    expect(btn.getAttribute("aria-label")).toBe("Edit grading criteria");
    fireEvent.click(btn);
    expect(onCustomizeClick).toHaveBeenCalledTimes(1);
  });
});
