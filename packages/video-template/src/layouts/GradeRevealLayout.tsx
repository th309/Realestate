import React from "react";
import { Sequence } from "remotion";
import { BrandBumper } from "../primitives/BrandBumper";
import { BrandOutroCard } from "../primitives/BrandOutroCard";
import { Intro } from "../scenes/Intro";
import { ScoreReveal } from "../scenes/ScoreReveal";
import { StatCards } from "../scenes/StatCards";
import { Outro } from "../scenes/Outro";
import type { VideoProps, TrendDirection } from "../types";
import { num, coerceStats } from "./helpers";

export const GradeRevealLayout: React.FC<VideoProps> = (props) => {
  const { dataBundle, resolvedMarket, ctaUrl } = props;
  const bundle = (dataBundle ?? {}) as Record<string, unknown>;
  const scoreObj = (bundle.score ?? {}) as {
    propertyiq_score?: number;
    grade?: string;
  };
  const homeValueObj = (bundle.home_value ?? {}) as {
    period_date?: string;
  };

  const score = num(scoreObj.propertyiq_score, 50);
  const grade = typeof scoreObj.grade === "string" ? scoreObj.grade : "FAIR";
  // Trend data isn't in the current MCP snapshot shape — show stable/0 until
  // the score history fetcher is wired. The script generator doesn't mention
  // trends either, so leaving these empty is accurate.
  const trend: TrendDirection = "stable";
  const trendChange = 0;
  const periodDate =
    typeof homeValueObj.period_date === "string"
      ? homeValueObj.period_date
      : new Date().toISOString().slice(0, 10);
  const stats = coerceStats(bundle);

  return (
    <>
      <Sequence from={0} durationInFrames={60}>
        <BrandBumper />
      </Sequence>
      <Sequence from={60} durationInFrames={60}>
        <Intro marketName={resolvedMarket.canonical_name} />
      </Sequence>
      <Sequence from={120} durationInFrames={210}>
        <ScoreReveal
          market={resolvedMarket.canonical_name}
          score={score}
          grade={grade}
          trend={trend}
          trendChange={trendChange}
          periodDate={periodDate}
        />
      </Sequence>
      <Sequence from={330} durationInFrames={240}>
        <StatCards market={resolvedMarket.canonical_name} stats={stats} />
      </Sequence>
      <Sequence from={570} durationInFrames={240}>
        <Outro ctaUrl={ctaUrl} />
      </Sequence>
      <Sequence from={810} durationInFrames={90}>
        <BrandOutroCard ctaUrl={ctaUrl} score={score} />
      </Sequence>
    </>
  );
};
