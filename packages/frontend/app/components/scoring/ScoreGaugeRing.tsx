"use client";

import React from "react";
import {
  getScoreLabel,
  getScoreMomentumArrow,
  getScoreMomentumColorClass,
} from "./ScoreDisplay";

/**
 * ScoreGaugeRing — the editorial "gauge" rendering of the PropertyIQ Score.
 *
 * A clean conic-gradient donut (vs. ScoreDisplay's segmented SVG arc) used on
 * the market-detail rail. Color is keyed to the absolute angle around the full
 * circle (0° = red … 360° = green); the arc is filled from 0° to the score angle
 * (score% of the circle) and a neutral track fills the remainder. So both the
 * arc length AND its leading-edge color encode the score. Rendered as a single
 * masked donut so the center is transparent (theme-independent, no hardcoded
 * hole color).
 *
 * Presentational only: callers own data-fetching and the null/unavailable state.
 * Momentum label + arrow + color reuse the shared vocabulary in ScoreDisplay.
 */
export interface ScoreGaugeRingProps {
  /** The score value (1–99, 50 = state average) */
  value: number;
  /** Outer diameter in px (default 156, matching the market-detail rail) */
  size?: number;
  /** Ring band thickness in px (default proportional: 18px at size 156) */
  thickness?: number;
  /** Show the momentum label + arrow beneath the number (default true) */
  showLabel?: boolean;
  /** Custom class name for the container */
  className?: string;
}

/**
 * Absolute red→green spectrum around the FULL ring: a color is keyed to its
 * angle's position on the whole 360° circle (0° = red, 360° = green), NOT to the
 * fill length. So the filled arc's leading-edge color encodes the score's
 * magnitude — a low score ends red/orange, a high score ends green, full green
 * only at 100. Amber and yellow are intermediate control points at their
 * absolute angles so the sweep stays vivid instead of passing through muddy
 * olive. This is a fixed data-viz scale (like the map palette and ScoreDisplay's
 * getScoreColor), not a themeable UI surface — so these stops are explicit. The
 * neutral track uses a semantic token so the remainder adapts to light/dark.
 */
const GAUGE_SPECTRUM: { deg: number; rgb: [number, number, number] }[] = [
  { deg: 0, rgb: [229, 57, 53] }, // #e53935 red
  { deg: 130, rgb: [255, 143, 0] }, // #ff8f00 amber
  { deg: 220, rgb: [255, 214, 0] }, // #ffd600 yellow
  { deg: 360, rgb: [0, 200, 83] }, // #00c853 green
];
const GAUGE_TRACK = "var(--color-surface-container-highest)";

const rgbStr = ([r, g, b]: [number, number, number]) => `rgb(${r}, ${g}, ${b})`;

/** Interpolate the absolute spectrum color at a given angle (0–360°). */
function spectrumColorAt(deg: number): string {
  const d = Math.min(Math.max(deg, 0), 360);
  for (let i = 1; i < GAUGE_SPECTRUM.length; i++) {
    const a = GAUGE_SPECTRUM[i - 1];
    const b = GAUGE_SPECTRUM[i];
    if (d <= b.deg) {
      const t = (d - a.deg) / (b.deg - a.deg);
      return rgbStr([
        Math.round(a.rgb[0] + (b.rgb[0] - a.rgb[0]) * t),
        Math.round(a.rgb[1] + (b.rgb[1] - a.rgb[1]) * t),
        Math.round(a.rgb[2] + (b.rgb[2] - a.rgb[2]) * t),
      ]);
    }
  }
  return rgbStr(GAUGE_SPECTRUM[GAUGE_SPECTRUM.length - 1].rgb);
}

export const ScoreGaugeRing: React.FC<ScoreGaugeRingProps> = ({
  value,
  size = 156,
  thickness,
  showLabel = true,
  className = "",
}) => {
  const clamped = Math.min(Math.max(value, 0), 100);
  const band = thickness ?? Math.round(size * (18 / 156));
  const fillDeg = (clamped / 100) * 360;

  // Reveal the absolute spectrum (0°=red … 360°=green) from 0° to the score
  // angle, then a hard cut to the neutral track for the remainder. Every
  // spectrum control point before the fill is passed through exactly, and only
  // the final sub-segment (last point → fillDeg) is interpolated to the tip —
  // which stays colinear, so the arc renders the true absolute-angle color.
  const stops = GAUGE_SPECTRUM.filter((p) => p.deg < fillDeg).map(
    (p) => `${rgbStr(p.rgb)} ${p.deg}deg`,
  );
  stops.push(`${spectrumColorAt(fillDeg)} ${fillDeg.toFixed(2)}deg`);
  stops.push(`${GAUGE_TRACK} ${fillDeg.toFixed(2)}deg`);
  stops.push(`${GAUGE_TRACK} 360deg`);
  const gradient = `conic-gradient(from 0deg, ${stops.join(", ")})`;

  // Punch the donut hole with a radial mask so the center is transparent
  // (works on any background / theme). farthest-side = size/2.
  const holePct = (1 - (2 * band) / size) * 100;
  const mask = `radial-gradient(farthest-side, transparent ${holePct.toFixed(2)}%, #000 ${(holePct + 0.6).toFixed(2)}%)`;

  const label = getScoreLabel(clamped);
  const arrow = getScoreMomentumArrow(clamped);
  const momentumColor = getScoreMomentumColorClass(clamped);

  const numberPx = Math.round(size * 0.269); // 42px at size 156
  const labelPx = Math.max(8, Math.round(size * 0.0577)); // 9px at size 156

  return (
    <div
      className={`relative flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`PropertyIQ Score ${Math.round(clamped)} out of 100, ${label} momentum`}
    >
      <div
        aria-hidden="true"
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: gradient,
          WebkitMask: mask,
          mask,
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 flex flex-col items-center justify-center"
      >
        <span
          className="font-mono font-bold text-on-surface leading-none"
          style={{ fontSize: numberPx }}
        >
          {Math.round(clamped)}
        </span>
        {showLabel && (
          <span
            className={`mt-1 font-mono font-semibold uppercase leading-none tracking-[0.12em] ${momentumColor}`}
            style={{ fontSize: labelPx }}
          >
            {label} {arrow}
          </span>
        )}
      </div>
    </div>
  );
};

export default ScoreGaugeRing;
