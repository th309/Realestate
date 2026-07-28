import React from "react";
import { AbsoluteFill } from "remotion";
import {
  AnimatedEntrance,
  useScriptedProgress,
  useSpringProgress,
} from "../motion";
import {
  BORDER_WIDTH,
  FONTS,
  NUMERIC,
  PALETTE,
  withAlpha,
} from "../styles/tokens";

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
 * Three movements, all settled within the first ~0.9s so the remaining hold
 * is a still magazine page rather than perpetual motion:
 *
 *   1. Rank stamp — lands on a house entrance spring, scaling 1.35 → 1.
 *      Reads like a printer's number plate landing on the page.
 *   2. City + state — spring-rise, with a hairline rule that wipes across
 *      after the city lands. The rule grounds the typography on a baseline.
 *   3. Value — count-up replaces Number.0/.1/etc. with the final number;
 *      gives a small "this is the data" reveal beat without an SFX hit.
 *
 * The count-up is deliberately a SCRIPTED move (interpolate + M3 emphasized
 * decelerate) rather than a spring counter: a caption-aligned row can be as
 * short as ~35 frames, and a `counter` spring needs ~76 to settle, which
 * would leave the final number never reaching its real value on tight rows.
 *
 * Every element enters through AnimatedEntrance on the house 4-frame stagger,
 * so no two siblings ever animate on the same frame.
 */
export const HeroRow: React.FC<HeroRowProps> = ({
  rank,
  marketName,
  state,
  valueFormatted,
  metricLabel,
  accent,
}) => {
  // Movement 1 — rank stamp lands (scale settle is bigger than the house
  // 1.05, so the stamp drives its own spring rather than AnimatedEntrance).
  const stampProgress = useSpringProgress({ preset: "entrance" });
  const stampScale = 1.35 - 0.35 * stampProgress;

  // Movement 2 — hairline rule wipes across once the city has landed.
  const ruleWidth = useScriptedProgress(14, 26, "standard") * 100;

  // Movement 3 — value count-up.
  const valueProgress = useScriptedProgress(22, 40, "emphasized");
  const valueDisplay = renderCountUp(valueFormatted, valueProgress);

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
          color: PALETTE.stageDeep,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: FONTS.mono,
          fontWeight: 800,
          fontSize: 168,
          lineHeight: 1,
          letterSpacing: "-0.05em",
          opacity: Math.min(1, stampProgress * 2.5),
          transform: `scale(${stampScale})`,
          boxShadow: `0 24px 80px ${withAlpha(accent, 0.4)}`,
          ...NUMERIC,
        }}
      >
        {rank}
      </div>

      {/* City — Roboto Black, tight letter-spacing for editorial weight */}
      <AnimatedEntrance index={1} delay={2} from="rise" distance={40}>
        <div
          style={{
            fontFamily: FONTS.display,
            fontWeight: 900,
            fontSize: 132,
            lineHeight: 0.95,
            letterSpacing: "-0.04em",
            color: PALETTE.surface,
            textAlign: "center",
            maxWidth: 920,
          }}
        >
          {marketName}
        </div>
      </AnimatedEntrance>

      {/* Rule — wipes horizontally after city lands */}
      <div
        style={{
          height: BORDER_WIDTH,
          width: `${ruleWidth}%`,
          maxWidth: 680,
          backgroundColor: PALETTE.indigoMedium,
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
        <AnimatedEntrance index={2} delay={8} from="rise" distance={16}>
          <div
            style={{
              fontFamily: FONTS.mono,
              fontWeight: 500,
              fontSize: 42,
              letterSpacing: "0.18em",
              color: PALETTE.indigoLight,
              textTransform: "uppercase",
            }}
          >
            {state}
          </div>
        </AnimatedEntrance>
        <AnimatedEntrance index={3} delay={10} from="rise" distance={20}>
          <div
            style={{
              fontFamily: FONTS.mono,
              fontWeight: 700,
              fontSize: 220,
              lineHeight: 1,
              letterSpacing: "-0.04em",
              color: accent,
              ...NUMERIC,
            }}
          >
            {valueDisplay}
          </div>
        </AnimatedEntrance>
        <AnimatedEntrance index={4} delay={10} from="rise" distance={12}>
          <div
            style={{
              fontFamily: FONTS.mono,
              fontWeight: 500,
              fontSize: 26,
              letterSpacing: "0.22em",
              color: PALETTE.indigoMuted,
              textTransform: "uppercase",
            }}
          >
            {metricLabel}
          </div>
        </AnimatedEntrance>
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
