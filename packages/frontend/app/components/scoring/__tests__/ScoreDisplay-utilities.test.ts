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
import { getScoreColorOnDark } from "../score-color";

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
  it("returns VERY STRONG for 90+", () => {
    expect(getScoreLabel(90)).toBe("VERY STRONG");
    expect(getScoreLabel(100)).toBe("VERY STRONG");
  });

  it("returns STRONG for 80-89", () => {
    expect(getScoreLabel(80)).toBe("STRONG");
    expect(getScoreLabel(89)).toBe("STRONG");
  });

  it("returns RISING for 70-79", () => {
    expect(getScoreLabel(70)).toBe("RISING");
    expect(getScoreLabel(79)).toBe("RISING");
  });

  it("returns FIRMING for 60-69", () => {
    expect(getScoreLabel(60)).toBe("FIRMING");
    expect(getScoreLabel(69)).toBe("FIRMING");
  });

  it("returns STEADY for 50-59", () => {
    expect(getScoreLabel(50)).toBe("STEADY");
    expect(getScoreLabel(59)).toBe("STEADY");
  });

  it("returns EASING for 40-49", () => {
    expect(getScoreLabel(40)).toBe("EASING");
    expect(getScoreLabel(49)).toBe("EASING");
  });

  it("returns WEAK for 20-39", () => {
    expect(getScoreLabel(20)).toBe("WEAK");
    expect(getScoreLabel(39)).toBe("WEAK");
  });

  it("returns VERY WEAK for < 20", () => {
    expect(getScoreLabel(19)).toBe("VERY WEAK");
    expect(getScoreLabel(0)).toBe("VERY WEAK");
  });
});

// ---------------------------------------------------------------------------
// getScoreColor
// ---------------------------------------------------------------------------

describe("getScoreColor (brand ramp: Error → Warning → Accent, §8.2)", () => {
  it("returns brand Error red (#B3261E) for score 0", () => {
    const color = getScoreColor(0);
    expect(color).toBe("hsl(3, 71%, 41%)");
  });

  it("returns brand Accent green (#00C853) for score 100", () => {
    const color = getScoreColor(100);
    expect(color).toBe("hsl(145, 100%, 39%)");
  });

  it("returns brand Warning amber (#FF8F00) at the midpoint (50)", () => {
    const color = getScoreColor(50);
    expect(color).toBe("hsl(34, 100%, 50%)");
  });

  it("clamps values above maxValue to the Accent green endpoint", () => {
    const color = getScoreColor(200, 100);
    expect(color).toBe("hsl(145, 100%, 39%)");
  });

  it("clamps negative values to the Error red endpoint", () => {
    const color = getScoreColor(-10, 100);
    expect(color).toBe("hsl(3, 71%, 41%)");
  });

  it("never emits the retired neon hsl(h, 100%, 50%) outside the amber anchor", () => {
    // Spot-check a few scores: saturation/lightness must come from the brand
    // ramp, not the old full-chroma gradient.
    expect(getScoreColor(99)).toBe("hsl(143, 100%, 39%)");
    expect(getScoreColor(25)).toBe("hsl(19, 86%, 46%)");
  });
});

describe("getScoreColorOnDark (lightness pinned for dark brand surfaces)", () => {
  it("lifts the dark Error-red low end to the 55% lightness floor", () => {
    expect(getScoreColorOnDark(0)).toBe("hsl(3, 71%, 55%)");
  });

  it("lifts the Accent-green high end to the floor as well", () => {
    expect(getScoreColorOnDark(100)).toBe("hsl(145, 100%, 55%)");
  });

  it("keeps the same hue/saturation as the base ramp", () => {
    expect(getScoreColorOnDark(50)).toBe("hsl(34, 100%, 55%)");
  });

  // Real contrast guard, not just string-pinning: the OnDark contract is
  // "large text on the darkest brand surface (#1A237E) clears WCAG 3:1".
  // Small-text surfaces must NOT use this as text color (see score-color.ts).
  it("worst-case red clears 3:1 large-text contrast on #1A237E", () => {
    const channel = (v: number) =>
      v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    const luminance = (r: number, g: number, b: number) =>
      0.2126 * channel(r / 255) +
      0.7152 * channel(g / 255) +
      0.0722 * channel(b / 255);
    const hslToRgb = (
      h: number,
      s: number,
      l: number,
    ): [number, number, number] => {
      const c = (1 - Math.abs(2 * l - 1)) * s;
      const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
      const m = l - c / 2;
      const [r, g, b] =
        h < 60
          ? [c, x, 0]
          : h < 120
            ? [x, c, 0]
            : h < 180
              ? [0, c, x]
              : [0, x, c];
      return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
    };
    const contrast = (l1: number, l2: number) =>
      (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

    const [h, s, l] = [3, 71, 55]; // getScoreColorOnDark(0)
    const red = luminance(...hslToRgb(h, s / 100, l / 100));
    const darkestSurface = luminance(0x1a, 0x23, 0x7e); // #1A237E
    expect(contrast(red, darkestSurface)).toBeGreaterThanOrEqual(3);
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
