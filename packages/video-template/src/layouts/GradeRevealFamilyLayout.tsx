import React from "react";
import { Sequence } from "remotion";
import { BrandBumper } from "../primitives/BrandBumper";
import { BrandOutroCard } from "../primitives/BrandOutroCard";
import { MeshBackground } from "../primitives/MeshBackground";
import { Intro } from "../scenes/Intro";
import { ScoreReveal } from "../scenes/ScoreReveal";
import { StatCards } from "../scenes/StatCards";
import { Outro } from "../scenes/Outro";
import type { SingleMarketVideoProps, TrendDirection } from "../types";
import { num, coerceStats } from "./helpers";
import { buildGradeRevealBeats } from "./grade-reveal-beats";

interface GradeRevealFamilyLayoutProps {
  videoProps: SingleMarketVideoProps;
  /** Beat-table multiplier: 1 (30s), 2.5 (75s brokerage), 3 (90s recruit). */
  scale?: number;
}

/**
 * Shared structure for the grade-reveal family: Bumper → Intro →
 * ScoreReveal → StatCards → Outro → BrandOutroCard over a persistent
 * MeshBackground (scenes paint no solid fills of their own). The three
 * format layouts are thin wrappers passing their beat-table scale.
 */
export const GradeRevealFamilyLayout: React.FC<
  GradeRevealFamilyLayoutProps
> = ({ videoProps, scale = 1 }) => {
  const { dataBundle, resolvedMarket, ctaUrl } = videoProps;
  const bundle = (dataBundle ?? {}) as Record<string, unknown>;
  const scoreObj = (bundle.score ?? {}) as {
    propertyiq_score?: number;
    grade?: string;
  };
  const homeValueObj = (bundle.home_value ?? {}) as { period_date?: string };

  const score = num(scoreObj.propertyiq_score, 50);
  const grade = typeof scoreObj.grade === "string" ? scoreObj.grade : "";
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
  const beats = buildGradeRevealBeats(scale);

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
        <Intro
          marketName={resolvedMarket.canonical_name}
          durationInFrames={beats.intro.duration}
        />
      </Sequence>
      <Sequence from={beats.score.from} durationInFrames={beats.score.duration}>
        <ScoreReveal
          market={resolvedMarket.canonical_name}
          score={score}
          grade={grade}
          trend={trend}
          trendChange={trendChange}
          periodDate={periodDate}
        />
      </Sequence>
      <Sequence from={beats.stats.from} durationInFrames={beats.stats.duration}>
        <StatCards market={resolvedMarket.canonical_name} stats={stats} />
      </Sequence>
      <Sequence from={beats.outro.from} durationInFrames={beats.outro.duration}>
        <Outro ctaUrl={ctaUrl} durationInFrames={beats.outro.duration} />
      </Sequence>
      <Sequence from={beats.brand.from} durationInFrames={beats.brand.duration}>
        <BrandOutroCard ctaUrl={ctaUrl} score={score} />
      </Sequence>
    </>
  );
};
