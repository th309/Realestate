import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import type {
  DealGradingResult,
  MetricResult,
  MetricThreshold,
} from "@propertyiq/analyzer-core";
import { GradingResultPanel } from "../GradingResultPanel";

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

function makeResult(
  overrides: Partial<DealGradingResult> = {},
): DealGradingResult {
  return {
    letter: "B",
    label: "Buy",
    summary: "Solid deal.",
    rawGpa: 2.85,
    marketAdjustment: 0,
    finalGpa: 2.85,
    metrics: [
      makeMetric({ key: "cashOnCash", label: "Cash-on-Cash" }),
      makeMetric({ key: "dscr", label: "DSCR" }),
    ],
    advisories: [
      {
        key: "one_percent_rule",
        label: "1% Rule",
        value: 0.011,
        status: "pass",
      },
      { key: "grm", label: "GRM", value: 9.0, status: "pass" },
      { key: "opex_ratio", label: "OpEx Ratio", value: 0.45, status: "pass" },
    ],
    autoKills: [],
    ...overrides,
  };
}

describe("GradingResultPanel", () => {
  it("renders all 4 sub-components when auto-kills present", () => {
    const result = makeResult({
      autoKills: [{ code: "X", message: "Killed it" }],
    });
    const { container } = render(<GradingResultPanel result={result} />);
    expect(container.querySelector("[data-auto-kill-banner]")).toBeTruthy();
    expect(container.querySelector("[data-recommendation-card]")).toBeTruthy();
    expect(
      container.querySelector("[data-score-breakdown-table]"),
    ).toBeTruthy();
    expect(container.querySelector("[data-advisories-strip]")).toBeTruthy();
  });

  it("omits AutoKillBanner when autoKills is empty", () => {
    const { container } = render(<GradingResultPanel result={makeResult()} />);
    expect(container.querySelector("[data-auto-kill-banner]")).toBeNull();
    expect(container.querySelector("[data-recommendation-card]")).toBeTruthy();
    expect(
      container.querySelector("[data-score-breakdown-table]"),
    ).toBeTruthy();
    expect(container.querySelector("[data-advisories-strip]")).toBeTruthy();
  });
});
