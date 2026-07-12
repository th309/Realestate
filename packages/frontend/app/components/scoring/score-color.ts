// Server-safe (no "use client") so Server Components (ScoreTeaser, OG images)
// can share the exact same ramp as client score components. Canonical export
// surface remains ScoreDisplay.tsx per CLAUDE.md §9 (it re-exports this).

/**
 * Brand score ramp (CLAUDE.md §8.2), as HSL triples:
 * 0 = Error #B3261E → midpoint = Warning #FF8F00 → max = Accent #00C853.
 * Literal values (not CSS vars) because this also runs server-side where
 * custom properties don't exist.
 */
const SCORE_RAMP: ReadonlyArray<readonly [number, number, number]> = [
  [3, 71, 41], // 0 — Error red #B3261E
  [34, 100, 50], // midpoint — Warning amber #FF8F00
  [145, 100, 39], // max — Accent green #00C853
];

const interpolateRamp = (
  value: number,
  maxValue: number,
): [number, number, number] => {
  const pct = Math.min(Math.max(value / maxValue, 0), 1);
  const [from, to] =
    pct < 0.5 ? [SCORE_RAMP[0], SCORE_RAMP[1]] : [SCORE_RAMP[1], SCORE_RAMP[2]];
  const t = (pct < 0.5 ? pct : pct - 0.5) / 0.5;
  return from.map((c, i) => Math.round(c + (to[i] - c) * t)) as [
    number,
    number,
    number,
  ];
};

/**
 * Continuous score color on the brand ramp: red (0) through amber (mid) to
 * green (max). Replaces the old neon `hsl(h, 100%, 50%)` gradient. For text
 * on dark brand surfaces use getScoreColorOnDark instead.
 */
export const getScoreColor = (
  value: number,
  maxValue: number = 100,
): string => {
  const [h, s, l] = interpolateRamp(value, maxValue);
  return `hsl(${h}, ${s}%, ${l}%)`;
};

/**
 * Same hue/saturation ramp with lightness pinned to 55% (every ramp anchor's
 * L is ≤50, so the max() is effectively constant ramp-wide). Contrast reality:
 * the red end clears only the 3:1 LARGE-text bar, and only against the darkest
 * brand surface (#1A237E) — it does NOT meet 4.5:1, nor 3:1 on #3949AB. So:
 * use for large text (≥24px) on the darkest surfaces (HeroSearchBar's 36px
 * score), or as a decorative accent (dots/strokes). Small text on dark must
 * stay white and carry this color on a non-text element instead — see
 * ScoreTeaserRow / StickyScoreBar.
 */
export const getScoreColorOnDark = (
  value: number,
  maxValue: number = 100,
): string => {
  const [h, s, l] = interpolateRamp(value, maxValue);
  return `hsl(${h}, ${s}%, ${Math.max(l, 55)}%)`;
};
