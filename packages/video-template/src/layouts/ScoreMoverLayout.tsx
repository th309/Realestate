import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { BrandBumper } from "../primitives/BrandBumper";
import { BrandOutroCard } from "../primitives/BrandOutroCard";
import { MeshBackground } from "../primitives/MeshBackground";
import { Intro } from "../scenes/Intro";
import { Outro } from "../scenes/Outro";
import { StatCards } from "../scenes/StatCards";
import {
  AnimatedEntrance,
  useCounterValue,
  useSpringProgress,
} from "../motion";
import {
  FONTS,
  NUMERIC,
  PALETTE,
  brandBorder,
  brandFill,
} from "../styles/tokens";
import { useLayoutConfig } from "../layout/useLayoutConfig";
import type { SingleMarketVideoProps } from "../types";
import { num, coerceStats } from "./helpers";

/**
 * Beat table for the score-move story. Exported so `audio/sfx-cues.ts` can
 * frame-lock its cues to the SAME numbers the layout renders from — audio
 * and motion can never drift apart.
 */
export const SCORE_MOVER_BEATS = {
  bumper: { from: 0, duration: 60 },
  intro: { from: 60, duration: 90 },
  delta: { from: 150, duration: 300 },
  stats: { from: 450, duration: 270 },
  outro: { from: 720, duration: 90 },
  brand: { from: 810, duration: 90 },
} as const;

/** Frames into the delta scene before the number starts ticking. */
export const DELTA_TICK_DELAY = 15;
/** Frames after tick start before the `counter` spring has settled. */
export const DELTA_SETTLE_FRAMES = 76;
/** Frames into the delta scene before the delta pill pops in. */
const DELTA_PILL_DELAY = 30;

/**
 * The score-move scene: tells the story "PropertyIQ Score went from N to M".
 * The number rides a heavy `counter` spring from prior → current (fast ramp,
 * long deceleration, no overshoot past the real value), and the delta pill
 * pops in mid-tick so it lands as the number arrives. Both hold for the rest
 * of the 10s window so the VO has time to land its supporting beats.
 *
 * No solid fill of its own — the layout's persistent MeshBackground shows
 * through every scene.
 */
const DeltaScene: React.FC<{
  currentScore: number;
  delta: number;
  windowCaption: string;
}> = ({ currentScore, delta, windowCaption }) => {
  const { scale } = useLayoutConfig();
  const priorScore = currentScore - delta;

  const animatedScore = useCounterValue(currentScore, {
    delay: DELTA_TICK_DELAY,
    from: priorScore,
  });
  const pillProgress = useSpringProgress({
    delay: DELTA_PILL_DELAY,
    preset: "pop",
  });

  const isPositive = delta >= 0;
  const signColor = isPositive ? PALETTE.positive : PALETTE.negative;
  const sign = isPositive ? "+" : "";

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 40 * scale,
      }}
    >
      <AnimatedEntrance index={0} from="rise">
        <div
          style={{
            color: PALETTE.indigoLight,
            fontFamily: FONTS.body,
            fontSize: 56 * scale,
            fontWeight: 500,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            textAlign: "center",
          }}
        >
          PropertyIQ Score moved
        </div>
      </AnimatedEntrance>

      {windowCaption ? (
        <AnimatedEntrance index={1} from="rise" distance={16}>
          <div
            style={{
              color: PALETTE.indigoLight,
              fontFamily: FONTS.mono,
              fontSize: 32 * scale,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              opacity: 0.85,
              ...NUMERIC,
            }}
          >
            {windowCaption}
          </div>
        </AnimatedEntrance>
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
            color: PALETTE.surface,
            fontFamily: FONTS.mono,
            fontWeight: 700,
            fontSize: 240 * scale,
            lineHeight: 1,
            // tabular-nums prevents the number from jittering horizontally
            // as the digits change width during the tick.
            minWidth: `${3.5 * 240 * scale * 0.6}px`,
            textAlign: "center",
            ...NUMERIC,
          }}
        >
          {Math.round(animatedScore)}
        </div>
        <div
          style={{
            transform: `scale(${pillProgress}) translateX(${(1 - pillProgress) * -40}px)`,
            opacity: Math.min(1, Math.max(0, pillProgress * 1.5)),
            background: brandFill(signColor),
            border: brandBorder(signColor),
            color: signColor,
            padding: `${10 * scale}px ${28 * scale}px`,
            borderRadius: 999,
            fontFamily: FONTS.mono,
            fontWeight: 700,
            fontSize: 80 * scale,
            ...NUMERIC,
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
  const beats = SCORE_MOVER_BEATS;
  return (
    <>
      <MeshBackground />
      <Sequence
        from={beats.bumper.from}
        durationInFrames={beats.bumper.duration}
      >
        <BrandBumper />
      </Sequence>
      <Sequence from={beats.intro.from} durationInFrames={beats.intro.duration}>
        <Intro marketName={props.resolvedMarket.canonical_name} />
      </Sequence>
      <Sequence from={beats.delta.from} durationInFrames={beats.delta.duration}>
        <DeltaScene
          currentScore={score}
          delta={delta}
          windowCaption={windowCaption}
        />
      </Sequence>
      <Sequence from={beats.stats.from} durationInFrames={beats.stats.duration}>
        <StatCards market={props.resolvedMarket.canonical_name} stats={stats} />
      </Sequence>
      <Sequence from={beats.outro.from} durationInFrames={beats.outro.duration}>
        <Outro ctaUrl={props.ctaUrl} />
      </Sequence>
      <Sequence from={beats.brand.from} durationInFrames={beats.brand.duration}>
        <BrandOutroCard ctaUrl={props.ctaUrl} score={score} />
      </Sequence>
    </>
  );
};
