import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { VideoProps, FORMAT_CONFIGS } from "./types";
import { VideoLayout } from "./layout/VideoLayout";
import { BrandBumper } from "./primitives/BrandBumper";
import { BrandOutroCard } from "./primitives/BrandOutroCard";
import { Intro } from "./scenes/Intro";
import { ScoreReveal } from "./scenes/ScoreReveal";
import { StatCards } from "./scenes/StatCards";
import { Outro } from "./scenes/Outro";
import type { MarketStats, TrendDirection } from "./types";

/**
 * Coerce the loosely-typed dataBundle into the shape that legacy
 * scenes expect. Missing fields fall back to safe defaults so the
 * Remotion Studio preview still renders before real data lands.
 */
function coerceStats(bundle: unknown): MarketStats {
  const b = (bundle ?? {}) as Record<string, unknown>;
  const homeValue = (b.home_value ?? {}) as { value?: number };
  const dom = (b.days_on_market ?? {}) as { value?: number };
  const demand = (b.demand ?? {}) as { value?: number };
  const pending = (b.pending_ratio ?? {}) as { value?: number };
  return {
    medianPrice: typeof homeValue.value === "number" ? homeValue.value : 385000,
    daysOnMarket: typeof dom.value === "number" ? dom.value : 28,
    demandScore: typeof demand.value === "number" ? demand.value : 60,
    pendingRatio: typeof pending.value === "number" ? pending.value : 0.5,
  };
}

export const PropertyIQVideo: React.FC<VideoProps> = (props) => {
  const cfg = FORMAT_CONFIGS[props.format];
  return (
    <VideoLayout config={cfg}>
      <AbsoluteFill style={{ backgroundColor: "#1A1A2E" }}>
        {props.format === "grade_reveal" && <GradeRevealLayout {...props} />}
        {/* Other formats rendered in later phases */}
      </AbsoluteFill>
    </VideoLayout>
  );
};

const GradeRevealLayout: React.FC<VideoProps> = (props) => {
  const { dataBundle, resolvedMarket, ctaUrl } = props;
  const bundle = (dataBundle ?? {}) as Record<string, unknown>;
  const score =
    typeof bundle.score === "number" ? (bundle.score as number) : 50;
  const grade =
    typeof bundle.grade === "string" ? (bundle.grade as string) : "FAIR";
  const trend: TrendDirection =
    bundle.trend === "up" ||
    bundle.trend === "down" ||
    bundle.trend === "stable"
      ? (bundle.trend as TrendDirection)
      : "stable";
  const trendChange =
    typeof bundle.trendChange === "number" ? (bundle.trendChange as number) : 0;
  const periodDate =
    typeof bundle.periodDate === "string"
      ? (bundle.periodDate as string)
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
