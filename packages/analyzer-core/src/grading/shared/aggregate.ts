/**
 * Cross-strategy grading primitives — pure functions used by every engine.
 *
 *   gradeMetric:    value + threshold → letter
 *   gpaPoints:      letter → numeric GPA points
 *   letterFromGpa:  GPA → letter (boundary rules)
 *   marketAdjustment: PIQ + strategy → GPA delta (strategy-aware bands)
 *   clampGpa:       clamp to [0, 4]
 */
import type { Letter, MetricThreshold, Strategy } from "./types";

export function gradeMetric(value: number, threshold: MetricThreshold): Letter {
  const { A, B, C, D, direction } = threshold;
  if (direction === "higher_is_better") {
    if (value >= A) return "A";
    if (value >= B) return "B";
    if (value >= C) return "C";
    if (value >= D) return "D";
    return "F";
  }
  // lower_is_better
  if (value <= A) return "A";
  if (value <= B) return "B";
  if (value <= C) return "C";
  if (value <= D) return "D";
  return "F";
}

export function gpaPoints(letter: Letter): number {
  switch (letter) {
    case "A":
      return 4;
    case "B":
      return 3;
    case "C":
      return 2;
    case "D":
      return 1;
    case "F":
      return 0;
  }
}

export function letterFromGpa(gpa: number): Letter {
  if (gpa >= 3.5) return "A";
  if (gpa >= 2.5) return "B";
  if (gpa >= 1.5) return "C";
  if (gpa >= 0.5) return "D";
  return "F";
}

/**
 * Strategy-aware market adjustment bands. PIQ scores are 0-100; the resulting
 * GPA delta is added to rawGpa pre-clamp inside each strategy's grade()
 * orchestrator.
 *
 *   BUY_AND_HOLD / BRRRR:  >=80 +0.25, 50-79 0,  30-49 -0.25, <30 -0.50
 *   FIX_AND_FLIP:          >=70 +0.25, 50-69 0,  35-49 -0.25, <35 -0.50
 *
 * F&F bands are looser at the top (a flip in a 70-PIQ market is already a
 * tailwind) and stricter at the bottom (illiquid markets disproportionately
 * hurt resale exits).
 */
export function marketAdjustment(
  piq: number | undefined,
  strategy: Strategy,
): number {
  if (piq === undefined || piq === null) return 0;
  if (strategy === "FIX_AND_FLIP") {
    if (piq >= 70) return 0.25;
    if (piq >= 50) return 0;
    if (piq >= 35) return -0.25;
    return -0.5;
  }
  // BUY_AND_HOLD and BRRRR (same bands for now — BRRRR placeholder).
  if (piq >= 80) return 0.25;
  if (piq >= 50) return 0;
  if (piq >= 30) return -0.25;
  return -0.5;
}

export function clampGpa(gpa: number): number {
  if (gpa < 0) return 0;
  if (gpa > 4) return 4;
  return gpa;
}
