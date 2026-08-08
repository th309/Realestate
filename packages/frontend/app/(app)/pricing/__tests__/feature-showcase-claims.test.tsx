/**
 * Every number on the pricing feature showcase is either sourced or labelled.
 *
 * The showcase sells a $39/month "institutional-grade edge" while rendering
 * hand-written Nashville panels as static JSX, and it previously asserted a
 * "+12% excess returns" figure that appears in no validation artifact. These
 * tests pin the two rules that fix that:
 *
 *   1. Any panel containing a sample figure carries an explicit "Illustrative
 *      example" label.
 *   2. Any performance or coverage claim comes from lib/data/validation-claims.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { COVERAGE_COPY, V4_CLAIMS } from "@/lib/data/validation-claims";
import {
  getScoreLabel,
  getScoreMomentumArrow,
} from "@/app/components/scoring/score-labels";

import { AIInsightsSection } from "../components/AIInsightsSection";
import { ScoresSection } from "../components/ScoresSection";
import { GeoDataSection } from "../components/GeoDataSection";
import { IllustrativeNote } from "../components/IllustrativeNote";

function textOf(ui: React.ReactElement): string {
  return render(ui).container.textContent ?? "";
}

function illustrativeCount(ui: React.ReactElement): number {
  const text = render(ui).container.textContent ?? "";
  return text.split("Illustrative example.").length - 1;
}

describe("IllustrativeNote", () => {
  it("states plainly that the figures are not live data", () => {
    const text = textOf(<IllustrativeNote />);
    expect(text).toContain("Illustrative example.");
    expect(text).toContain("not live Nashville data");
  });
});

describe("Mock product panels are labelled", () => {
  it("labels both Nashville narrative panels in the AI insights section", () => {
    expect(illustrativeCount(<AIInsightsSection />)).toBe(2);
  });

  it("labels both Nashville panels in the scores section", () => {
    expect(illustrativeCount(<ScoresSection />)).toBe(2);
  });

  it("labels both drill-down panels in the geo data section", () => {
    expect(illustrativeCount(<GeoDataSection />)).toBe(2);
  });
});

describe("Scores section claims", () => {
  it("drops the unsourced +12% excess-returns figure", () => {
    const text = textOf(<ScoresSection />);
    expect(text).not.toContain("+12%");
    expect(text).not.toContain("excess returns");
  });

  it("cites the measured top-band excess from validation-claims", () => {
    const text = textOf(<ScoresSection />);
    expect(text).toContain(`+${V4_CLAIMS.topQuintile3YExcess}pp`);
    expect(text).toContain("Score 81–99 markets");
    expect(text).toContain("annualized 3-year excess vs state");
  });

  it("renders the sample score with its momentum label, not a quality word", () => {
    const text = textOf(<ScoresSection />);
    expect(text).toContain("68");
    expect(text).toContain(`${getScoreLabel(68)} ${getScoreMomentumArrow(68)}`);
    for (const quality of ["EXCELLENT", "GOOD", "POOR", "FAIR"]) {
      expect(text).not.toContain(quality);
    }
  });

  it("presents confidence as data quality rather than a grade of the score", () => {
    const text = textOf(<ScoresSection />);
    expect(text).toContain("Confidence B — data quality, not a grade");
    expect(text).not.toContain("No grades or market rankings");
  });

  it("states the 1–99 range and the state-average midpoint", () => {
    const text = textOf(<ScoresSection />);
    expect(text).toContain("1–99");
    expect(text).toContain("50 means the market is tracking its state average");
    expect(text).not.toContain("0–100");
  });
});

describe("Geo data section coverage claims", () => {
  it("counts only the levels Pro actually unlocks", () => {
    const text = textOf(<GeoDataSection />);
    expect(text).toContain(
      `${COVERAGE_COPY.counties} counties and ${COVERAGE_COPY.zips} ZIP codes unlocked`,
    );
    // The all-levels total includes metros, which Free already sees.
    expect(text).not.toContain("additional markets unlocked");
  });

  it("sources the free metro count from COVERAGE_COPY", () => {
    const text = textOf(<GeoDataSection />);
    expect(text).toContain(`${COVERAGE_COPY.metros} metro-level dashboards`);
    expect(text).not.toContain("400+ metro");
  });

  it("no longer asserts invented ZIP-level appreciation and cap-rate numbers as fact", () => {
    const text = textOf(<GeoDataSection />);
    expect(text).not.toContain(
      "Nashville metro looks moderate — but ZIP 37209 is appreciating at 5.1%",
    );
  });
});
