import type { Letter } from "@propertyiq/analyzer-core";

export interface GradeColorSet {
  fg: string;
  bg: string;
  glow: string;
}

export const GRADE_COLORS: Record<Letter, GradeColorSet> = {
  A: { fg: "#00C853", bg: "rgba(0,200,83,0.08)", glow: "rgba(0,200,83,0.45)" },
  B: {
    fg: "#66BB6A",
    bg: "rgba(102,187,106,0.08)",
    glow: "rgba(102,187,106,0.35)",
  },
  C: {
    fg: "#FFB300",
    bg: "rgba(255,179,0,0.08)",
    glow: "rgba(255,179,0,0.35)",
  },
  D: {
    fg: "#FB8C00",
    bg: "rgba(251,140,0,0.08)",
    glow: "rgba(251,140,0,0.35)",
  },
  F: {
    fg: "#E53935",
    bg: "rgba(229,57,53,0.08)",
    glow: "rgba(229,57,53,0.45)",
  },
};

export function getGradeColor(letter: Letter): GradeColorSet {
  return GRADE_COLORS[letter];
}
