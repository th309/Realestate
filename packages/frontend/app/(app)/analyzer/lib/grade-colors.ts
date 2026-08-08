import type { Letter } from "@propertyiq/analyzer-core";

export interface GradeColorSet {
  fg: string;
  bg: string;
}

/**
 * Grade colours, on the analyzer palette.
 *
 * Three tones, not five. These were five hardcoded hex values — a distinct
 * mid-green for B and a distinct orange for D — which had two problems: they
 * were literals that stayed put in dark mode, and #FFB300 on a white card is
 * 1.9:1, so a C pill was effectively unreadable. The letter already carries
 * the granularity, so the colour only has to say pass / borderline / fail:
 * green for A–B, amber for C–D, red for F. Every value is a token, so the
 * whole set inverts with the scheme.
 */
const PASS: GradeColorSet = {
  fg: "var(--piq-green)",
  bg: "var(--piq-green-soft)",
};

const BORDERLINE: GradeColorSet = {
  fg: "var(--piq-amber)",
  bg: "var(--piq-amber-soft)",
};

const FAIL: GradeColorSet = {
  fg: "var(--piq-red)",
  bg: "var(--piq-red-soft)",
};

export const GRADE_COLORS: Record<Letter, GradeColorSet> = {
  A: PASS,
  B: PASS,
  C: BORDERLINE,
  D: BORDERLINE,
  F: FAIL,
};

export function getGradeColor(letter: Letter): GradeColorSet {
  return GRADE_COLORS[letter];
}
