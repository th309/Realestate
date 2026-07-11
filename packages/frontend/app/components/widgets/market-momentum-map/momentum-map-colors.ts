/**
 * MOMENTUM MAP COLOR SCALE
 *
 * Single source of truth for the Market Momentum Map's score→color mapping.
 * Diverging around 50 (STEADY = the market's state average), anchored to the
 * canonical momentum-label buckets in app/components/scoring/score-labels.ts.
 * These are DATA colors (same precedent as the map page's COLOR_SCALE) — all
 * UI chrome around them must keep using M3 semantic tokens.
 */

import { scaleLinear } from "d3";

export interface MomentumColorStop {
  score: number;
  color: string;
  label: string;
}

/** Anchors at the momentum-label bucket boundaries; interpolated between. */
export const MOMENTUM_COLOR_STOPS: MomentumColorStop[] = [
  { score: 1, color: "#8c1d18", label: "VERY WEAK" },
  { score: 20, color: "#b3261e", label: "WEAK" },
  { score: 40, color: "#e07a3f", label: "EASING" },
  { score: 50, color: "#a8adc4", label: "STEADY" },
  { score: 60, color: "#7bc89a", label: "FIRMING" },
  { score: 70, color: "#43b371", label: "RISING" },
  { score: 80, color: "#12995b", label: "STRONG" },
  { score: 99, color: "#00753f", label: "VERY STRONG" },
];

/** Low-opacity neutral — reads as "off", never as a low score. */
export const NO_DATA_COLOR = "rgba(148, 153, 170, 0.18)";

const momentumScale = scaleLinear<string>()
  .domain(MOMENTUM_COLOR_STOPS.map((s) => s.score))
  .range(MOMENTUM_COLOR_STOPS.map((s) => s.color))
  .clamp(true);

export function scoreToColor(score: number): string {
  if (!score || score <= 0) return NO_DATA_COLOR;
  return momentumScale(score);
}

/** CSS gradient for the legend bar, built from the same stops. */
export function momentumLegendGradient(): string {
  const span =
    MOMENTUM_COLOR_STOPS[MOMENTUM_COLOR_STOPS.length - 1].score -
    MOMENTUM_COLOR_STOPS[0].score;
  const stops = MOMENTUM_COLOR_STOPS.map(
    (s) =>
      `${s.color} ${Math.round(((s.score - MOMENTUM_COLOR_STOPS[0].score) / span) * 100)}%`,
  );
  return `linear-gradient(to right, ${stops.join(", ")})`;
}

export interface FrameSummary {
  risingPct: number;
  steadyPct: number;
  easingPct: number;
  scoredCount: number;
}

/**
 * Per-month momentum breakdown for the summary strip — mirrors the forecast
 * page copy: "firming or rising" (>=60), "steady" (50-59), "easing or weak"
 * (1-49). 0 = no data, excluded from the denominator.
 */
export function summarizeFrame(
  scores: number[][],
  monthIdx: number,
): FrameSummary {
  let rising = 0;
  let steady = 0;
  let easing = 0;
  let scored = 0;
  for (const row of scores) {
    const s = row[monthIdx];
    if (!s) continue;
    scored++;
    if (s >= 60) rising++;
    else if (s >= 50) steady++;
    else easing++;
  }
  const pct = (n: number) =>
    scored === 0 ? 0 : Math.round((n / scored) * 100);
  return {
    risingPct: pct(rising),
    steadyPct: pct(steady),
    easingPct: pct(easing),
    scoredCount: scored,
  };
}
