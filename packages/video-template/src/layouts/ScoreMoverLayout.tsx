import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { BrandBumper } from "../primitives/BrandBumper";
import { BrandOutroCard } from "../primitives/BrandOutroCard";
import { DeltaDisplay } from "../primitives/DeltaDisplay";
import { Intro } from "../scenes/Intro";
import { Outro } from "../scenes/Outro";
import { StatCards } from "../scenes/StatCards";
import type { VideoProps } from "../types";
import { num, coerceStats } from "./helpers";

export const ScoreMoverLayout: React.FC<VideoProps> = (props) => {
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
        <AbsoluteFill
          style={{
            backgroundColor: "#1A1A2E",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 32,
          }}
        >
          <div
            style={{
              color: "#C5CAE9",
              fontFamily: "Roboto",
              fontSize: 36,
              fontWeight: 500,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            PropertyIQ Score moved
          </div>
          {windowCaption ? (
            <div
              style={{
                color: "#C5CAE9",
                fontFamily: "Roboto Mono",
                fontSize: 22,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                opacity: 0.85,
              }}
            >
              {windowCaption}
            </div>
          ) : null}
          <DeltaDisplay delta={delta} />
          <div
            style={{
              color: "#FFFFFF",
              fontFamily: "Roboto Mono",
              fontSize: 28,
              opacity: 0.7,
            }}
          >
            now {score}
          </div>
        </AbsoluteFill>
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
