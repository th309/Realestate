import type { Letter, MetricThreshold } from "./types";

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

export function marketAdjustment(piq?: number): number {
  if (piq === undefined || piq === null) return 0;
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
