/**
 * ScoreDisplay Utility Functions — Unit Tests
 *
 * Tests the pure utility functions exported from ScoreDisplay.tsx:
 * - getLetterGrade: score number -> letter grade (A+ through F)
 * - getScoreLabel: score number -> descriptor (EXCELLENT through VERY POOR)
 * - getScoreColor: score number -> HSL color string
 * - getGradeColor: letter grade -> Tailwind color classes
 *
 * These utilities are used throughout the scoring system to ensure
 * consistent display of scores, grades, and labels.
 */

import { describe, it, expect } from "vitest";
import {
  getLetterGrade,
  getScoreLabel,
  getScoreColor,
  getGradeColor,
  MARKET_THRESHOLDS,
} from "../ScoreDisplay";

// ---------------------------------------------------------------------------
// getLetterGrade
// ---------------------------------------------------------------------------

describe("getLetterGrade", () => {
  it("returns A+ for score >= 97", () => {
    expect(getLetterGrade(97)).toBe("A+");
    expect(getLetterGrade(100)).toBe("A+");
  });

  it("returns A for 93-96", () => {
    expect(getLetterGrade(93)).toBe("A");
    expect(getLetterGrade(96)).toBe("A");
  });

  it("returns A- for 90-92", () => {
    expect(getLetterGrade(90)).toBe("A-");
    expect(getLetterGrade(92)).toBe("A-");
  });

  it("returns B+ for 87-89", () => {
    expect(getLetterGrade(87)).toBe("B+");
    expect(getLetterGrade(89)).toBe("B+");
  });

  it("returns B for 83-86", () => {
    expect(getLetterGrade(83)).toBe("B");
    expect(getLetterGrade(86)).toBe("B");
  });

  it("returns B- for 80-82", () => {
    expect(getLetterGrade(80)).toBe("B-");
    expect(getLetterGrade(82)).toBe("B-");
  });

  it("returns C+ for 77-79", () => {
    expect(getLetterGrade(77)).toBe("C+");
    expect(getLetterGrade(79)).toBe("C+");
  });

  it("returns C for 73-76", () => {
    expect(getLetterGrade(73)).toBe("C");
    expect(getLetterGrade(76)).toBe("C");
  });

  it("returns C- for 70-72", () => {
    expect(getLetterGrade(70)).toBe("C-");
    expect(getLetterGrade(72)).toBe("C-");
  });

  it("returns D+ for 67-69", () => {
    expect(getLetterGrade(67)).toBe("D+");
    expect(getLetterGrade(69)).toBe("D+");
  });

  it("returns D for 63-66", () => {
    expect(getLetterGrade(63)).toBe("D");
    expect(getLetterGrade(66)).toBe("D");
  });

  it("returns D- for 60-62", () => {
    expect(getLetterGrade(60)).toBe("D-");
    expect(getLetterGrade(62)).toBe("D-");
  });

  it("returns F for score < 60", () => {
    expect(getLetterGrade(59)).toBe("F");
    expect(getLetterGrade(0)).toBe("F");
    expect(getLetterGrade(30)).toBe("F");
  });
});

// ---------------------------------------------------------------------------
// getScoreLabel
// ---------------------------------------------------------------------------

describe("getScoreLabel", () => {
  it("returns EXCELLENT for 90+", () => {
    expect(getScoreLabel(90)).toBe("EXCELLENT");
    expect(getScoreLabel(100)).toBe("EXCELLENT");
  });

  it("returns GREAT for 80-89", () => {
    expect(getScoreLabel(80)).toBe("GREAT");
    expect(getScoreLabel(89)).toBe("GREAT");
  });

  it("returns GOOD for 70-79", () => {
    expect(getScoreLabel(70)).toBe("GOOD");
    expect(getScoreLabel(79)).toBe("GOOD");
  });

  it("returns FAIR for 60-69", () => {
    expect(getScoreLabel(60)).toBe("FAIR");
    expect(getScoreLabel(69)).toBe("FAIR");
  });

  it("returns AVERAGE for 50-59", () => {
    expect(getScoreLabel(50)).toBe("AVERAGE");
    expect(getScoreLabel(59)).toBe("AVERAGE");
  });

  it("returns BELOW AVG for 40-49", () => {
    expect(getScoreLabel(40)).toBe("BELOW AVG");
    expect(getScoreLabel(49)).toBe("BELOW AVG");
  });

  it("returns POOR for 20-39", () => {
    expect(getScoreLabel(20)).toBe("POOR");
    expect(getScoreLabel(39)).toBe("POOR");
  });

  it("returns VERY POOR for < 20", () => {
    expect(getScoreLabel(19)).toBe("VERY POOR");
    expect(getScoreLabel(0)).toBe("VERY POOR");
  });
});

// ---------------------------------------------------------------------------
// getScoreColor
// ---------------------------------------------------------------------------

describe("getScoreColor", () => {
  it("returns red hue (0) for score 0", () => {
    const color = getScoreColor(0);
    expect(color).toBe("hsl(0, 100%, 50%)");
  });

  it("returns green hue (120) for score 100", () => {
    const color = getScoreColor(100);
    expect(color).toBe("hsl(120, 100%, 50%)");
  });

  it("returns yellow-ish hue (60) for score 50", () => {
    const color = getScoreColor(50);
    expect(color).toBe("hsl(60, 100%, 50%)");
  });

  it("clamps values above maxValue to 120 hue", () => {
    const color = getScoreColor(200, 100);
    expect(color).toBe("hsl(120, 100%, 50%)");
  });

  it("clamps negative values to 0 hue", () => {
    const color = getScoreColor(-10, 100);
    expect(color).toBe("hsl(0, 100%, 50%)");
  });
});

// ---------------------------------------------------------------------------
// getGradeColor
// ---------------------------------------------------------------------------

describe("getGradeColor", () => {
  it("returns green for A grades", () => {
    expect(getGradeColor("A+")).toEqual({
      bg: "bg-green-500",
      text: "text-white",
    });
    expect(getGradeColor("A")).toEqual({
      bg: "bg-green-500",
      text: "text-white",
    });
    expect(getGradeColor("A-")).toEqual({
      bg: "bg-green-500",
      text: "text-white",
    });
  });

  it("returns emerald for B grades", () => {
    expect(getGradeColor("B+")).toEqual({
      bg: "bg-emerald-500",
      text: "text-white",
    });
    expect(getGradeColor("B")).toEqual({
      bg: "bg-emerald-500",
      text: "text-white",
    });
  });

  it("returns yellow for C grades", () => {
    expect(getGradeColor("C")).toEqual({
      bg: "bg-yellow-500",
      text: "text-white",
    });
  });

  it("returns orange for D grades", () => {
    expect(getGradeColor("D")).toEqual({
      bg: "bg-orange-500",
      text: "text-white",
    });
  });

  it("returns red for F grade", () => {
    expect(getGradeColor("F")).toEqual({
      bg: "bg-red-500",
      text: "text-white",
    });
  });
});

// ---------------------------------------------------------------------------
// MARKET_THRESHOLDS
// ---------------------------------------------------------------------------

describe("MARKET_THRESHOLDS", () => {
  it("has sellersMax at 33", () => {
    expect(MARKET_THRESHOLDS.sellersMax).toBe(33);
  });

  it("has balancedMax at 66", () => {
    expect(MARKET_THRESHOLDS.balancedMax).toBe(66);
  });
});
