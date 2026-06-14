import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import type { MetricResult, MetricThreshold } from "@propertyiq/analyzer-core";
import { ScoreBreakdownTable } from "../ScoreBreakdownTable";

const threshold: MetricThreshold = {
  A: 0.12,
  B: 0.1,
  C: 0.08,
  D: 0.06,
  direction: "higher_is_better",
};

function makeMetric(over: Partial<MetricResult> = {}): MetricResult {
  return {
    key: "cashOnCash",
    label: "Cash-on-Cash",
    value: 0.1,
    formattedValue: "10.0%",
    grade: "B",
    gpaPoints: 3,
    weight: 25,
    contribution: 0.75,
    threshold,
    ...over,
  };
}

describe("ScoreBreakdownTable", () => {
  it("renders one row per metric", () => {
    const metrics = [
      makeMetric({ key: "cashOnCash", label: "Cash-on-Cash" }),
      makeMetric({ key: "dscr", label: "DSCR" }),
      makeMetric({ key: "capRate", label: "Cap Rate" }),
    ];
    const { container } = render(
      <ScoreBreakdownTable
        metrics={metrics}
        rawGpa={2.85}
        marketAdjustment={0.15}
        finalGpa={3.0}
        finalLetter="B"
      />,
    );
    expect(container.querySelectorAll("[data-metric-row]").length).toBe(3);
  });

  it("renders footer with formatted rawGpa, marketAdjustment, finalGpa", () => {
    const { container, getByText } = render(
      <ScoreBreakdownTable
        metrics={[makeMetric()]}
        rawGpa={2.85}
        marketAdjustment={0.15}
        finalGpa={3.0}
        finalLetter="B"
      />,
    );
    const raw = container.querySelector('[data-footer-row="raw-gpa"]');
    const adj = container.querySelector('[data-footer-row="market-adj"]');
    const fin = container.querySelector('[data-footer-row="final-gpa"]');
    expect(raw?.textContent).toContain("2.85");
    expect(adj?.textContent).toContain("+0.15");
    expect(fin?.textContent).toContain("3.00");
    expect(getByText("Raw GPA")).toBeTruthy();
    expect(getByText("Market adjustment")).toBeTruthy();
    expect(getByText("Final GPA")).toBeTruthy();
  });

  it("renders negative market adjustment with leading minus", () => {
    const { container } = render(
      <ScoreBreakdownTable
        metrics={[makeMetric()]}
        rawGpa={2.85}
        marketAdjustment={-0.2}
        finalGpa={2.65}
        finalLetter="C"
      />,
    );
    const adj = container.querySelector('[data-footer-row="market-adj"]');
    expect(adj?.textContent).toContain("-0.20");
  });

  it("final grade pill aria-label includes 'Grade {letter}'", () => {
    const { container } = render(
      <ScoreBreakdownTable
        metrics={[makeMetric()]}
        rawGpa={2.85}
        marketAdjustment={0}
        finalGpa={2.85}
        finalLetter="A"
      />,
    );
    const finRow = container.querySelector('[data-footer-row="final-gpa"]');
    const pill = finRow?.querySelector("[data-grade-pill]");
    expect(pill?.getAttribute("aria-label")).toBe("Grade A");
  });
});
