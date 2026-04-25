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
import { Comparison } from "./scenes/Comparison";
import { RankingRow } from "./primitives/RankingRow";
import { DeltaDisplay } from "./primitives/DeltaDisplay";
import type {
  MarketStats,
  TrendDirection,
  MarketData,
  ComparisonMarket,
} from "./types";

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
        {props.format === "score_mover" && <ScoreMoverLayout {...props} />}
        {props.format === "head_to_head" && <HeadToHeadLayout {...props} />}
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

function coerceMarketData(raw: any, fallbackName: string): MarketData {
  const scoreObj = raw?.score ?? {};
  const score = num(scoreObj.propertyiq_score ?? raw?.propertyiq_score, 50);
  const grade =
    typeof scoreObj.grade === "string"
      ? scoreObj.grade
      : typeof raw?.grade === "string"
        ? raw.grade
        : "FAIR";
  const market =
    typeof raw?.canonical_name === "string"
      ? raw.canonical_name
      : typeof raw?.name === "string"
        ? raw.name
        : typeof raw?.market === "string"
          ? raw.market
          : fallbackName;
  // Trend isn't in the snapshot shape — same as GradeRevealLayout's stable/0 fallback.
  const trend: TrendDirection = "stable";
  const trendChange = 0;
  const periodDate =
    typeof raw?.home_value?.period_date === "string"
      ? raw.home_value.period_date
      : new Date().toISOString().slice(0, 10);
  const stats = coerceStats(raw ?? {});
  return {
    market,
    score,
    grade,
    trend,
    trendChange,
    stats,
    history: [],
    periodDate,
  };
}

function coerceComparisonMarket(
  raw: any,
  fallbackName: string,
): ComparisonMarket {
  const m = coerceMarketData(raw, fallbackName);
  return {
    market: m.market,
    score: m.score,
    grade: m.grade,
    trend: m.trend,
    trendChange: m.trendChange,
  };
}

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
              {/*
                Center the row horizontally with a generous max-width. The plan's
                literal `padding: '40%'` would have squeezed the 9:16 frame to a
                216px-wide strip, which can't fit a 56px rank circle + name + stat.
              */}
              <AbsoluteFill
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 60px",
                }}
              >
                <div style={{ width: "100%", maxWidth: 960 }}>
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
                </div>
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

const ScoreMoverLayout: React.FC<VideoProps> = (props) => {
  const bundle = (props.dataBundle ?? {}) as Record<string, unknown>;
  const scoreObj = (bundle.score ?? {}) as {
    propertyiq_score?: number;
    score_delta?: number;
  };
  const score = num(scoreObj.propertyiq_score, 50);
  const delta = num(scoreObj.score_delta, 0);
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

const HeadToHeadLayout: React.FC<VideoProps> = (props) => {
  const bundle = (props.dataBundle ?? {}) as Record<string, any>;
  // Accept both shape A (markets array) and shape B (primary/secondary).
  const arr: any[] = Array.isArray(bundle.markets) ? bundle.markets : [];
  const a = arr[0] ?? bundle.primary ?? null;
  const b = arr[1] ?? bundle.secondary ?? null;
  const primary = coerceMarketData(a, "Market A");
  const secondary = coerceComparisonMarket(b, "Market B");
  return (
    <>
      <Sequence from={0} durationInFrames={60}>
        <BrandBumper />
      </Sequence>
      <Sequence from={60} durationInFrames={90}>
        {/*
          Strip the state suffix from each market name for the intro so the
          comma-split inside `Intro` doesn't render "Cleveland / OH vs Austin, TX".
          Full names still appear inside the Comparison scene below.
        */}
        <Intro
          marketName={`${primary.market.split(",")[0].trim()} vs ${secondary.market.split(",")[0].trim()}`}
        />
      </Sequence>
      <Sequence from={150} durationInFrames={1500}>
        <Comparison primary={primary} others={[secondary]} />
      </Sequence>
      <Sequence from={1650} durationInFrames={90}>
        <Outro ctaUrl={props.ctaUrl} />
      </Sequence>
      <Sequence from={1740} durationInFrames={60}>
        <BrandOutroCard ctaUrl={props.ctaUrl} score={primary.score} />
      </Sequence>
    </>
  );
};
