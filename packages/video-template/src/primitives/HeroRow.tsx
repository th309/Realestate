import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

interface HeroRowProps {
  rank: number;
  marketName: string;
  state: string;
  valueFormatted: string;
  metricLabel: string;
  /** Accent for the rank stamp + value tint. Top vs bottom theme color. */
  accent: string;
}

/**
 * Editorial hero treatment for a single ranking row. Centred on the frame.
 * Three movements, all settled within the first ~0.6s so the remaining hold
 * is a still magazine page rather than perpetual motion:
 *
 *   1. Rank stamp — drops in with a high-damping spring + scale settle.
 *      Reads like a printer's number plate landing on the page.
 *   2. City + state — fade-and-rise with a hairline rule that draws across
 *      after the city lands. The rule grounds the typography on a baseline.
 *   3. Value — count-up replaces Number.0/.1/etc. with the final number;
 *      gives a small "this is the data" reveal beat without an SFX hit.
 *
 * No bouncy springs, no zoom-bombs, no confetti. The aesthetic is
 * Bloomberg-meets-Apple-Keynote, not TikTok-meets-game-show.
 */
export const HeroRow: React.FC<HeroRowProps> = ({
  rank,
  marketName,
  state,
  valueFormatted,
  metricLabel,
  accent,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Movement 1 — rank stamp lands.
  const rankSpring = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 110 },
    durationInFrames: 18,
  });
  const rankScale = interpolate(rankSpring, [0, 1], [1.35, 1]);
  const rankOpacity = interpolate(frame, [0, 8], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Movement 2 — city rise, then rule draws.
  const cityRise = interpolate(frame, [4, 18], [40, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cityOpacity = interpolate(frame, [4, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ruleWidth = interpolate(frame, [14, 26], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const stateOpacity = interpolate(frame, [18, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Movement 3 — value count-up reveal.
  const valueProgress = interpolate(frame, [22, 40], [0, 1], {
    easing: Easing.out(Easing.quad),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const valueDisplay = renderCountUp(valueFormatted, valueProgress);
  const valueOpacity = interpolate(frame, [22, 32], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 80px",
        gap: 36,
      }}
    >
      {/* Rank stamp */}
      <div
        style={{
          width: 280,
          height: 280,
          borderRadius: "50%",
          backgroundColor: accent,
          color: "#08081A",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Roboto Mono', monospace",
          fontWeight: 800,
          fontSize: 168,
          lineHeight: 1,
          letterSpacing: "-0.05em",
          opacity: rankOpacity,
          transform: `scale(${rankScale})`,
          boxShadow: `0 24px 80px ${hexToRgba(accent, 0.4)}`,
        }}
      >
        {rank}
      </div>

      {/* City — Roboto Black, tight letter-spacing for editorial weight */}
      <div
        style={{
          fontFamily: "'Roboto', sans-serif",
          fontWeight: 900,
          fontSize: 132,
          lineHeight: 0.95,
          letterSpacing: "-0.04em",
          color: "#FFFFFF",
          textAlign: "center",
          opacity: cityOpacity,
          transform: `translateY(${cityRise}px)`,
          maxWidth: 920,
        }}
      >
        {marketName}
      </div>

      {/* Rule — draws horizontally after city lands */}
      <div
        style={{
          height: 2,
          width: `${ruleWidth}%`,
          maxWidth: 680,
          backgroundColor: "#5C6BC0",
        }}
      />

      {/* State + value column */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
        }}
      >
        <div
          style={{
            fontFamily: "'Roboto Mono', monospace",
            fontWeight: 500,
            fontSize: 42,
            letterSpacing: "0.18em",
            color: "#C5CAE9",
            textTransform: "uppercase",
            opacity: stateOpacity,
          }}
        >
          {state}
        </div>
        <div
          style={{
            fontFamily: "'Roboto Mono', monospace",
            fontWeight: 700,
            fontSize: 220,
            lineHeight: 1,
            letterSpacing: "-0.04em",
            color: accent,
            opacity: valueOpacity,
          }}
        >
          {valueDisplay}
        </div>
        <div
          style={{
            fontFamily: "'Roboto Mono', monospace",
            fontWeight: 500,
            fontSize: 26,
            letterSpacing: "0.22em",
            color: "#9FA8DA",
            textTransform: "uppercase",
            opacity: valueOpacity,
          }}
        >
          {metricLabel}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/**
 * Animate the numeric portion of a formatted value from 0 → final over the
 * given progress (0..1). Preserves prefixes/suffixes ("$", "%", " days") so
 * "$1.2M" and "12.4%" both count up correctly.
 */
function renderCountUp(formatted: string, progress: number): string {
  if (progress >= 1) return formatted;
  const match = formatted.match(/^([^\d.-]*)([\d.,-]+)(.*)$/);
  if (!match) return formatted;
  const [, prefix, numStr, suffix] = match;
  const finalNum = parseFloat(numStr.replace(/,/g, ""));
  if (Number.isNaN(finalNum)) return formatted;
  const live = finalNum * progress;
  const decimals = (numStr.split(".")[1] ?? "").length;
  return `${prefix}${live.toFixed(decimals)}${suffix}`;
}

function hexToRgba(hex: string, alpha: number): string {
  const m = hex.replace("#", "");
  const bigint = parseInt(m, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
