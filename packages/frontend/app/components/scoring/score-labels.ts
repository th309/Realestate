/**
 * Pure PropertyIQ Score → momentum/timing verbal utilities.
 *
 * Extracted from ScoreDisplay.tsx (a "use client" component) so SERVER
 * components — e.g. the SEO market pages' FAQ builder — can import them without
 * pulling a client component into the server graph. ScoreDisplay.tsx re-exports
 * these unchanged, so every existing import site keeps working (SSOT preserved,
 * zero behavior change).
 *
 * The PropertyIQ Score is a demand-MOMENTUM / timing signal, not a quality
 * grade — the labels describe the market's current demand TREND (where it's
 * heading), NOT whether it's a "good" or "bad" place. A low score means cooling
 * momentum, NOT a poor-quality market. 50 = the market's state average
 * ("STEADY"). Keep these words momentum-framed; never reintroduce quality words
 * (EXCELLENT/POOR/etc.). See CLAUDE.md §9.
 */

/** Get the momentum descriptor label for a score (0-100). */
export const getScoreLabel = (score: number): string => {
  if (score >= 90) return "VERY STRONG";
  if (score >= 80) return "STRONG";
  if (score >= 70) return "RISING";
  if (score >= 60) return "FIRMING";
  if (score >= 50) return "STEADY";
  if (score >= 40) return "EASING";
  if (score >= 20) return "WEAK";
  return "VERY WEAK";
};

/**
 * Direction arrow for the momentum label (↑ strengthening, → steady, ↓ easing).
 * Pairs with getScoreLabel to reinforce the timing-signal framing.
 */
export const getScoreMomentumArrow = (score: number): string => {
  if (score >= 60) return "↑";
  if (score >= 50) return "→";
  if (score >= 40) return "↘";
  return "↓";
};

/** One-line descriptor clarifying the score is a momentum/timing signal. */
export const SCORE_MOMENTUM_DESCRIPTOR =
  "Momentum & timing signal — the market's current demand trend, not a quality grade.";
