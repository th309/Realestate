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

/** 90s vertical format; Grade Reveal timings scaled 3x. */
export const RecruitmentAngleLayout: React.FC<SingleMarketVideoProps> = (
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
      <Sequence from={0} durationInFrames={180}>
        <BrandBumper />
      </Sequence>
      <Sequence from={180} durationInFrames={180}>
        <Intro marketName={resolvedMarket.canonical_name} />
      </Sequence>
      <Sequence from={360} durationInFrames={630}>
        <ScoreReveal
          market={resolvedMarket.canonical_name}
          score={score}
          grade={grade}
          trend={trend}
          trendChange={trendChange}
          periodDate={periodDate}
        />
      </Sequence>
      <Sequence from={990} durationInFrames={720}>
        <StatCards market={resolvedMarket.canonical_name} stats={stats} />
      </Sequence>
      <Sequence from={1710} durationInFrames={720}>
        <Outro ctaUrl={ctaUrl} />
      </Sequence>
      <Sequence from={2430} durationInFrames={270}>
        <BrandOutroCard ctaUrl={ctaUrl} score={score} />
      </Sequence>
    </>
  );
};
