import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
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
});
