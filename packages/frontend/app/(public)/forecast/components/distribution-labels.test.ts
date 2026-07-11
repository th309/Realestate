import { describe, it, expect } from "vitest";
import {
  RISING_LABELS,
  STEADY_LABELS,
  EASING_LABELS,
} from "./distribution-phrase";

/** The 8 canonical momentum labels from getScoreLabel (CLAUDE.md §9). */
const ALL_LABELS = [
  "VERY STRONG",
  "STRONG",
  "RISING",
  "FIRMING",
  "STEADY",
  "EASING",
  "WEAK",
  "VERY WEAK",
];

describe("DistributionSummary's rising/steady/easing groups partition the 8 canonical labels", () => {
  it("unions to exactly the 8 canonical labels", () => {
    const union = [...RISING_LABELS, ...STEADY_LABELS, ...EASING_LABELS].sort();
    expect(union).toEqual([...ALL_LABELS].sort());
  });

  it("has no label appearing in more than one group", () => {
    const groups = [RISING_LABELS, STEADY_LABELS, EASING_LABELS];
    for (const label of ALL_LABELS) {
      const memberships = groups.filter((g) => g.includes(label));
      expect(memberships).toHaveLength(1);
    }
  });
});
