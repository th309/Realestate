/**
 * MOMENTUM MAP COLOR SCALE
 *
 * Single source of truth for the Market Momentum Map's score→color mapping.
 * Diverging around 50 (STEADY = the market's state average), anchored to the
 * canonical momentum-label buckets in app/components/scoring/score-labels.ts.
 * These are DATA colors (same precedent as the map page's COLOR_SCALE) — all
 * UI chrome around them must keep using M3 semantic tokens.
 *
 * Two stop sets: dark mode is a SELECTED palette, not a flip — the light
 * extremes (#8c1d18, #00753f) fall below 3:1 contrast on the dark surface,
 * so the dark set uses brighter anchors (validated ≥3:1 vs #1A1A2E with the
 * dataviz palette validator, 2026-07-11).
 */

import { scaleLinear } from "d3";

export type MomentumColorMode = "light" | "dark";

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

/** Brighter anchors for dark surfaces (extremes must not sink into #1A1A2E). */
export const MOMENTUM_COLOR_STOPS_DARK: MomentumColorStop[] = [
  { score: 1, color: "#ff5449", label: "VERY WEAK" },
  { score: 20, color: "#f0705e", label: "WEAK" },
  { score: 40, color: "#f2a65a", label: "EASING" },
  { score: 50, color: "#8f95a8", label: "STEADY" },
  { score: 60, color: "#85cfa4", label: "FIRMING" },
  { score: 70, color: "#43c281", label: "RISING" },
  { score: 80, color: "#2fbf75", label: "STRONG" },
  { score: 99, color: "#37d996", label: "VERY STRONG" },
];

/** Low-opacity neutral — reads as "off", never as a low score. */
export const NO_DATA_COLOR = "rgba(148, 153, 170, 0.18)";

function buildScale(stops: MomentumColorStop[]) {
  return scaleLinear<string>()
    .domain(stops.map((s) => s.score))
    .range(stops.map((s) => s.color))
    .clamp(true);
}

const momentumScales: Record<
  MomentumColorMode,
  ReturnType<typeof buildScale>
> = {
  light: buildScale(MOMENTUM_COLOR_STOPS),
  dark: buildScale(MOMENTUM_COLOR_STOPS_DARK),
};

export function stopsForMode(mode: MomentumColorMode): MomentumColorStop[] {
  return mode === "dark" ? MOMENTUM_COLOR_STOPS_DARK : MOMENTUM_COLOR_STOPS;
}

export function scoreToColor(
  score: number,
  mode: MomentumColorMode = "light",
): string {
  if (!score || score <= 0) return NO_DATA_COLOR;
  return momentumScales[mode](score);
}

/** CSS gradient for the legend bar, built from the same stops as the dots. */
export function momentumLegendGradient(
  mode: MomentumColorMode = "light",
): string {
  const stops = stopsForMode(mode);
  const span = stops[stops.length - 1].score - stops[0].score;
  const parts = stops.map(
    (s) =>
      `${s.color} ${Math.round(((s.score - stops[0].score) / span) * 100)}%`,
  );
  return `linear-gradient(to right, ${parts.join(", ")})`;
}
