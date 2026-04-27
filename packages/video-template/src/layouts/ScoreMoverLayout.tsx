import React from "react";
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BrandBumper } from "../primitives/BrandBumper";
import { BrandOutroCard } from "../primitives/BrandOutroCard";
import { Intro } from "../scenes/Intro";
import { Outro } from "../scenes/Outro";
import { StatCards } from "../scenes/StatCards";
import { useLayoutConfig } from "../layout/useLayoutConfig";
import type { SingleMarketVideoProps } from "../types";
import { num, coerceStats } from "./helpers";

/**
 * The score-move scene: tells the story "PropertyIQ Score went from N to M".
 * The number ticks from prior → current over ~1.5s, then the delta pill
 * springs in alongside. Both hold for the rest of the 10s window so the
 * VO has time to land its supporting beats.
 */
const DeltaScene: React.FC<{
  currentScore: number;
  delta: number;
  windowCaption: string;
}> = ({ currentScore, delta, windowCaption }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { scale } = useLayoutConfig();

  const priorScore = currentScore - delta;

  // Number tick: frames 15-60 (after a brief beat to read the title).
  const TICK_START = 15;
  const TICK_DURATION = 45;
  const animatedScore = interpolate(
    frame,
    [TICK_START, TICK_START + TICK_DURATION],
    [priorScore, currentScore],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    },
  );

  // Delta pill enters mid-tick so it lands as the number arrives.
  const pillSpring = spring({
    frame: frame - 30,
    fps,
    config: { damping: 12, stiffness: 90 },
  });

  const isPositive = delta >= 0;
  const pillColor = isPositive ? "#00C853" : "#B3261E";
  const sign = isPositive ? "+" : "";

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#1A1A2E",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 40 * scale,
      }}
    >
      <div
        style={{
          color: "#C5CAE9",
          fontFamily: "Roboto",
          fontSize: 56 * scale,
          fontWeight: 500,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          textAlign: "center",
        }}
      >
        PropertyIQ Score moved
      </div>

      {windowCaption ? (
        <div
          style={{
            color: "#C5CAE9",
            fontFamily: "Roboto Mono",
            fontSize: 32 * scale,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            opacity: 0.85,
          }}
        >
          {windowCaption}
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 32 * scale,
        }}
      >
        <div
          style={{
            color: "white",
            fontFamily: "Roboto Mono",
            fontWeight: 700,
            fontSize: 240 * scale,
            lineHeight: 1,
            // tabular-nums prevents the number from jittering horizontally
            // as the digits change width during the tick.
            fontVariantNumeric: "tabular-nums",
            minWidth: `${3.5 * 240 * scale * 0.6}px`,
            textAlign: "center",
          }}
        >
          {Math.round(animatedScore)}
        </div>
        <div
          style={{
            transform: `scale(${pillSpring}) translateX(${(1 - pillSpring) * -40}px)`,
            opacity: pillSpring,
            background: pillColor,
            color: "white",
            padding: `${10 * scale}px ${28 * scale}px`,
            borderRadius: 999,
            fontFamily: "Roboto Mono",
            fontWeight: 700,
            fontSize: 80 * scale,
          }}
        >
          {sign}
          {delta}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const ScoreMoverLayout: React.FC<SingleMarketVideoProps> = (props) => {
  const bundle = (props.dataBundle ?? {}) as Record<string, unknown>;
  const scoreObj = (bundle.score ?? {}) as {
    propertyiq_score?: number;
    score_delta?: number;
    window_caption?: string;
  };
  const score = num(scoreObj.propertyiq_score, 50);
  const delta = num(scoreObj.score_delta, 0);
  const windowCaption = scoreObj.window_caption ?? "";
  const stats = coerceStats(bundle);
  return (
    <>
      <Sequence from={0} durationInFrames={60}>
        <BrandBumper />
      </Sequence>
      <Sequence from={60} durationInFrames={90}>
        <Intro marketName={props.resolvedMarket.canonical_name} />
      </Sequence>
      <Sequence from={150} durationInFrames={300}>
        <DeltaScene
          currentScore={score}
          delta={delta}
          windowCaption={windowCaption}
        />
      </Sequence>
      <Sequence from={450} durationInFrames={270}>
        <StatCards market={props.resolvedMarket.canonical_name} stats={stats} />
      </Sequence>
      <Sequence from={720} durationInFrames={90}>
        <Outro ctaUrl={props.ctaUrl} />
      </Sequence>
      <Sequence from={810} durationInFrames={90}>
        <BrandOutroCard ctaUrl={props.ctaUrl} score={score} />
      </Sequence>
    </>
  );
};
