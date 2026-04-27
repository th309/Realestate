import React from "react";
import { Sequence } from "remotion";
import { BrandBumper } from "../primitives/BrandBumper";
import { BrandOutroCard } from "../primitives/BrandOutroCard";
import { Intro } from "../scenes/Intro";
import { ScoreReveal } from "../scenes/ScoreReveal";
import { StatCards } from "../scenes/StatCards";
import { Outro } from "../scenes/Outro";
import type { SingleMarketVideoProps, TrendDirection } from "../types";
import { num, coerceStats } from "./helpers";

/** 75s vertical format; structure mirrors Grade Reveal timings scaled 2.5x. */
export const BrokerageMarketShareLayout: React.FC<SingleMarketVideoProps> = (
  props,
) => {
  const { dataBundle, resolvedMarket, ctaUrl } = props;
  const bundle = (dataBundle ?? {}) as Record<string, unknown>;
  const scoreObj = (bundle.score ?? {}) as {
    propertyiq_score?: number;
    grade?: string;
  };
  const homeValueObj = (bundle.home_value ?? {}) as { period_date?: string };
  const score = num(scoreObj.propertyiq_score, 50);
  const grade = typeof scoreObj.grade === "string" ? scoreObj.grade : "FAIR";
  const trend: TrendDirection = "stable";
  const trendChange = 0;
  const periodDate =
    typeof homeValueObj.period_date === "string"
      ? homeValueObj.period_date
      : new Date().toISOString().slice(0, 10);
  const stats = coerceStats(bundle);

  return (
    <>
      <Sequence from={0} durationInFrames={150}>
        <BrandBumper />
      </Sequence>
      <Sequence from={150} durationInFrames={150}>
        <Intro marketName={resolvedMarket.canonical_name} />
      </Sequence>
      <Sequence from={300} durationInFrames={525}>
        <ScoreReveal
          market={resolvedMarket.canonical_name}
          score={score}
          grade={grade}
          trend={trend}
          trendChange={trendChange}
          periodDate={periodDate}
        />
      </Sequence>
      <Sequence from={825} durationInFrames={600}>
        <StatCards market={resolvedMarket.canonical_name} stats={stats} />
      </Sequence>
      <Sequence from={1425} durationInFrames={600}>
        <Outro ctaUrl={ctaUrl} />
      </Sequence>
      <Sequence from={2025} durationInFrames={225}>
        <BrandOutroCard ctaUrl={ctaUrl} score={score} />
      </Sequence>
    </>
  );
};
