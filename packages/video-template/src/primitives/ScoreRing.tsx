import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, scoreTierColor } from "../constants";
import { SPRINGS } from "../motion";
import { CHART, FONTS, brandFill, PALETTE, withAlpha } from "../styles/tokens";

export interface ScoreRingProps {
  score: number;
  size: number;
  /** Frames before the sweep begins (stagger against siblings). */
  delay?: number;
  strokeWidth?: number;
  /** Hide the numeral when the parent renders its own readout. */
  showNumber?: boolean;
  /**
   * Sweep the dial, or draw it already arrived. Defaults to sweeping.
   *
   * A spring driven by useCurrentFrame() renders its PRE-animation state at
   * frame 0 — an empty arc reading zero. That is invisible inside a video,
   * where frame 0 flicks past, but it is the entire image on a one-frame
   * still, so thumbnails must opt out of the motion.
   */
  animate?: boolean;
}

/**
 * The PropertyIQ signature motion element: the score dial spin-up.
 * A heavy spring sweeps the arc to the score while the mono numeral
 * counts alongside it; when the sweep settles, the endpoint dot pulses
 * with a soft glow (the same endpoint-pulse the web charts use).
 *
 * Every score-forward moment across every format mounts THIS component —
 * ScoreReveal, Comparison, BrandOutroCard — so the dial reads as a
 * recurring brand motif, not a per-scene rendering.
 */
export const ScoreRing: React.FC<ScoreRingProps> = ({
  score,
  size,
  delay = 0,
  strokeWidth,
  showNumber = true,
  animate = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const animated = spring({
    frame: frame - delay,
    fps,
    config: SPRINGS.counter,
  });
  const progress = animate ? animated : 1;

  const stroke = strokeWidth ?? Math.max(8, size * 0.05);
  const radius = size / 2 - stroke - CHART.endpointRadius;
  const circumference = 2 * Math.PI * radius;
  const fraction = progress * (score / 100);
  const offset = circumference * (1 - fraction);
  const color = scoreTierColor(score);

  // Endpoint dot rides the arc head; pulses once the sweep has settled.
  const angle = -Math.PI / 2 + fraction * Math.PI * 2;
  const dotX = size / 2 + radius * Math.cos(angle);
  const dotY = size / 2 + radius * Math.sin(angle);
  const settled = Math.min(1, Math.max(0, (progress - 0.92) / 0.08));
  const pulse = 0.5 + 0.5 * Math.sin((frame - delay) * 0.18);

  return (
    <svg width={size} height={size}>
      {/* Track: brand 8% fill, never a hard grey */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={brandFill(PALETTE.indigoLight)}
        strokeWidth={stroke}
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{
          filter: `drop-shadow(0 0 ${stroke}px ${withAlpha(color, 0.5)})`,
        }}
      />
      {/* Endpoint glow pulse (settles → breathes) */}
      <circle
        cx={dotX}
        cy={dotY}
        r={CHART.endpointRadius * (1.7 + 0.6 * pulse)}
        fill={withAlpha(color, settled * (0.18 + 0.14 * pulse))}
      />
      <circle
        cx={dotX}
        cy={dotY}
        r={CHART.endpointRadius}
        fill={color}
        opacity={0.35 + 0.65 * settled}
      />
      {showNumber && (
        <>
          <text
            x="50%"
            y="47%"
            dy="0.35em"
            textAnchor="middle"
            fontFamily={FONTS.mono}
            fontWeight={700}
            fontSize={size * 0.34}
            fill={color}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {Math.round(score * progress)}
          </text>
          <text
            x="50%"
            y="47%"
            dy="2.6em"
            textAnchor="middle"
            fontFamily={FONTS.mono}
            fontWeight={500}
            fontSize={size * 0.07}
            fill={COLORS.textMuted}
            letterSpacing="0.1em"
          >
            / 100
          </text>
        </>
      )}
    </svg>
  );
};
