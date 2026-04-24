import React from "react";
import { AbsoluteFill, Audio, Sequence } from "remotion";
import { VideoProps, FORMAT_CONFIGS } from "./types";
import { VideoLayout } from "./layout/VideoLayout";
import { BrandBumper } from "./primitives/BrandBumper";
import { BrandOutroCard } from "./primitives/BrandOutroCard";
import { Intro } from "./scenes/Intro";
import { ScoreReveal } from "./scenes/ScoreReveal";
import { StatCards } from "./scenes/StatCards";
import { Outro } from "./scenes/Outro";
import { RankingRow } from "./primitives/RankingRow";
import type { MarketStats, TrendDirection } from "./types";

/**
 * Coerce the MCP-shaped dataBundle into the shape the scenes need.
 * The payload comes from `ContentDataService.getMarketSnapshot` and has
 * the nested shape: { score, home_value, rent, demographics, economic, geo }.
 */
function coerceStats(bundle: Record<string, unknown>): MarketStats {
  const homeValue = (bundle.home_value ?? {}) as {
    value?: number;
    yoy_pct?: number;
  };
  const rent = (bundle.rent ?? {}) as { value?: number };
  const demo = (bundle.demographics ?? {}) as {
    population?: number;
    median_income?: number;
    homeownership_pct?: number;
  };
  return {
    medianPrice: num(homeValue.value, 0),
    homeValueYoyPct: num(homeValue.yoy_pct, 0),
    homeownershipPct: num(demo.homeownership_pct, 0),
    population: num(demo.population, 0),
    medianIncome: num(demo.median_income, 0),
    medianRent: num(rent.value, 0),
  };
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

export const PropertyIQVideo: React.FC<VideoProps> = (props) => {
  const cfg = FORMAT_CONFIGS[props.format];
  return (
    <VideoLayout config={cfg}>
      <AbsoluteFill style={{ backgroundColor: "#1A1A2E" }}>
        {props.format === "grade_reveal" && <GradeRevealLayout {...props} />}
        {props.format === "top_10_ranking" && <Top10Layout {...props} />}
        {/* Other formats rendered in later phases */}
      </AbsoluteFill>
      {/*
        Delay voice-over until after the 2-second BrandBumper (60 frames
        @ 30fps) so the brand sting plays clean, without the narrator
        talking over the intro logo. Audio plays from its start through
        to its natural end (ffprobe cap in synthesize-audio.handler
        ensures audio_length <= duration - audio_buffer_seconds, so even
        the longest legal audio still ends before the video does).
      */}
      {props.audioUrl && (
        <Sequence from={60}>
          <Audio src={props.audioUrl} />
        </Sequence>
      )}
    </VideoLayout>
  );
};

const GradeRevealLayout: React.FC<VideoProps> = (props) => {
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

function pickState(props: VideoProps): string {
  const fromBundle = (props.dataBundle as any)?.state;
  if (typeof fromBundle === "string" && fromBundle.length > 0)
    return fromBundle;
  const cn = props.resolvedMarket?.canonical_name ?? "";
  const parts = cn.split(",").map((s: string) => s.trim());
  return parts.length > 1 ? parts[parts.length - 1] : cn;
}

const Top10Layout: React.FC<VideoProps> = (props) => {
  const rankings = ((props.dataBundle as any)?.top_cashflow_markets ??
    []) as Array<{
    rank: number;
    name: string;
    rent_to_price_ratio: number;
  }>;
  const state = pickState(props);
  const ROW_FRAMES = 132; // 4.4s @ 30fps
  return (
    <>
      <Sequence from={0} durationInFrames={60}>
        <BrandBumper />
      </Sequence>
      <Sequence from={60} durationInFrames={90}>
        <Intro
          marketName={state ? `Top 10 Cashflow: ${state}` : "Top 10 Cashflow"}
        />
      </Sequence>
      <Sequence from={150} durationInFrames={ROW_FRAMES * 10}>
        {rankings
          .slice(0, 10)
          .reverse()
          .map((m, i) => (
            <Sequence
              key={m.rank}
              from={i * ROW_FRAMES}
              durationInFrames={ROW_FRAMES}
            >
              <AbsoluteFill style={{ padding: "40%" }}>
                <RankingRow
                  rank={m.rank}
                  marketName={m.name}
                  keyStat={
                    typeof m.rent_to_price_ratio === "number"
                      ? m.rent_to_price_ratio.toFixed(2)
                      : "—"
                  }
                  keyStatLabel="Rent/Price"
                />
              </AbsoluteFill>
            </Sequence>
          ))}
      </Sequence>
      <Sequence from={1470} durationInFrames={210}>
        <Outro ctaUrl={props.ctaUrl} />
      </Sequence>
      <Sequence from={1680} durationInFrames={120}>
        <BrandOutroCard ctaUrl={props.ctaUrl} />
      </Sequence>
    </>
  );
};
