import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { BrandBumper } from "../primitives/BrandBumper";
import { BrandOutroCard } from "../primitives/BrandOutroCard";
import { Intro } from "../scenes/Intro";
import { ScoreReveal } from "../scenes/ScoreReveal";
import { StatCards } from "../scenes/StatCards";
import { TrendChart } from "../scenes/TrendChart";
import { Outro } from "../scenes/Outro";
import { EconomicPulse } from "../scenes/EconomicPulse";
import { NarrativeBeat } from "../scenes/NarrativeBeat";
import { MapboxUsToPrincipalZoom } from "../scenes/MapboxUsToPrincipalZoom";
import { MetroHeroStill } from "../scenes/MetroHeroStill";
import type {
  ScoreHistoryPoint,
  SingleMarketVideoProps,
  TrendDirection,
} from "../types";
import {
  COLORS,
  LONG_FORM_FALLBACK_BODY_WEIGHTS,
  LONG_FORM_MAP_INTRO_SECONDS,
  LONG_FORM_METRO_HERO_SECONDS,
} from "../constants";
import {
  computeLongFormIntroTimeline,
  resolveMetroHeroImageUrlForMarket,
} from "../lib/long-form-intro-timeline";
import { isMetroPopulationTop200 } from "../lib/metro-hero-eligibility";
import { num, coerceStats, coerceEconomic } from "./helpers";

type PlanSeg = {
  kind: string;
  fromFrame: number;
  durationInFrames: number;
  sceneKey?: string;
  excerpt?: string;
};

function humanizeChapterTitle(sceneKey?: string): string {
  if (!sceneKey) return "Market snapshot";
  if (/chapter[_\s]*4/i.test(sceneKey)) return "Who this market is for";
  return sceneKey.replace(/_/g, " ");
}

/**
 * 16:9 long-form layout. When `longFormRenderPlan` is present (caption-aligned
 * chapter boundaries), scene timing follows narration; otherwise segments use
 * proportional fallback slices.
 */
export const LongFormDeepDiveLayout: React.FC<SingleMarketVideoProps> = (
  props,
) => {
  const { durationInFrames, fps, width, height } = useVideoConfig();
  const { dataBundle, resolvedMarket, ctaUrl, longFormRenderPlan } = props;
  const bundle = (dataBundle ?? {}) as Record<string, unknown>;
  const scoreObj = (bundle.score ?? {}) as {
    propertyiq_score?: number;
    grade?: string;
    confidence?: string;
    history?: ScoreHistoryPoint[];
    trend?: TrendDirection;
    trend_change?: number;
  };
  const homeValueObj = (bundle.home_value ?? {}) as { period_date?: string };
  const score = num(scoreObj.propertyiq_score, 50);
  const grade = typeof scoreObj.grade === "string" ? scoreObj.grade : "FAIR";
  const confidenceRaw =
    typeof scoreObj.confidence === "string"
      ? scoreObj.confidence.trim()
      : undefined;
  const confidenceLetter =
    confidenceRaw && /^[A-F]$/i.test(confidenceRaw)
      ? confidenceRaw.toUpperCase()
      : undefined;

  const trend: TrendDirection =
    scoreObj.trend === "up" ||
    scoreObj.trend === "down" ||
    scoreObj.trend === "stable"
      ? scoreObj.trend
      : "stable";
  const trendChange =
    typeof scoreObj.trend_change === "number" ? scoreObj.trend_change : 0;
  const periodDate =
    typeof homeValueObj.period_date === "string"
      ? homeValueObj.period_date
      : new Date().toISOString().slice(0, 10);
  const stats = coerceStats(bundle);
  const history = Array.isArray(scoreObj.history) ? scoreObj.history : [];
  const economic = coerceEconomic(bundle);

  const marketName = resolvedMarket.canonical_name;

  const renderIntroForDuration = (introFrames: number) => {
    const lat = resolvedMarket.latitude;
    const lng = resolvedMarket.longitude;
    if (typeof lat === "number" && typeof lng === "number") {
      const timeline = computeLongFormIntroTimeline(
        introFrames,
        fps,
        resolvedMarket,
      );
      const heroUrl = resolveMetroHeroImageUrlForMarket(resolvedMarket);
      const showHero = timeline.heroFrames > 0 && Boolean(heroUrl);
      return (
        <>
          <Sequence from={0} durationInFrames={timeline.mapFrames}>
            <MapboxUsToPrincipalZoom
              durationInFrames={timeline.mapFrames}
              targetLatitude={lat}
              targetLongitude={lng}
              marketLabel={marketName}
            />
          </Sequence>
          {showHero && heroUrl ? (
            <Sequence
              from={timeline.mapFrames}
              durationInFrames={timeline.heroFrames}
            >
              <MetroHeroStill imageUrl={heroUrl} marketLabel={marketName} />
            </Sequence>
          ) : null}
          {timeline.padFrames > 0 ? (
            <Sequence
              from={timeline.mapFrames + (showHero ? timeline.heroFrames : 0)}
              durationInFrames={timeline.padFrames}
            >
              <AbsoluteFill style={{ backgroundColor: COLORS.bg }} />
            </Sequence>
          ) : null}
        </>
      );
    }
    return <Intro marketName={marketName} />;
  };

  const trendScene =
    history.length > 0 ? (
      <TrendChart
        market={marketName}
        history={history}
        currentScore={score}
      />
    ) : economic ? (
      <EconomicPulse
        market={marketName}
        unemploymentPct={economic.unemployment_rate}
        jobGrowthYoyPct={economic.job_growth_yoy_pct}
      />
    ) : (
      <StatCards market={marketName} stats={stats} />
    );

  const renderSegment = (seg: PlanSeg) => {
    switch (seg.kind) {
      case "intro":
        return renderIntroForDuration(seg.durationInFrames);
      case "stats":
        return <StatCards market={marketName} stats={stats} />;
      case "score":
        return (
          <ScoreReveal
            market={marketName}
            score={score}
            grade={grade}
            trend={trend}
            trendChange={trendChange}
            periodDate={periodDate}
            confidenceLetter={confidenceLetter}
          />
        );
      case "trend":
        return trendScene;
      case "chapter_beat":
        return (
          <NarrativeBeat
            market={marketName}
            title={humanizeChapterTitle(seg.sceneKey)}
            excerpt={typeof seg.excerpt === "string" ? seg.excerpt : ""}
          />
        );
      case "outro":
        return <Outro ctaUrl={ctaUrl} />;
      case "brand_padding":
        return <BrandOutroCard ctaUrl={ctaUrl} score={score} />;
      default:
        return null;
    }
  };

  const planSegments = longFormRenderPlan?.segments as PlanSeg[] | undefined;

  if (planSegments && planSegments.length > 0) {
    return (
      <>
        <Sequence from={0} durationInFrames={60}>
          <BrandBumper />
        </Sequence>
        {planSegments.map((seg, i) => (
          <Sequence
            key={`${seg.kind}-${seg.fromFrame}-${i}`}
            from={seg.fromFrame}
            durationInFrames={Math.max(1, seg.durationInFrames)}
          >
            {renderSegment(seg)}
          </Sequence>
        ))}
      </>
    );
  }

  const rest = Math.max(0, durationInFrames - 60);
  /** Reserve frames so stats/score/trend/outro/brand can still breathe on short comps. */
  const minBodyFrames = 180;
  const mapIntroTarget = Math.round(fps * LONG_FORM_MAP_INTRO_SECONDS);
  const heroCapFrames = Math.round(fps * LONG_FORM_METRO_HERO_SECONDS);
  const canMetroHero =
    resolvedMarket.geography === "metro" &&
    isMetroPopulationTop200(resolvedMarket.id) &&
    Boolean(resolveMetroHeroImageUrlForMarket(resolvedMarket));
  const introBudgetMax =
    mapIntroTarget + (canMetroHero ? heroCapFrames : 0);
  const intro = Math.min(
    introBudgetMax,
    Math.max(1, rest - minBodyFrames),
  );
  const bodySplit = Math.max(0, rest - intro);
  const minBrandFrames = 60;
  const pool = Math.max(0, bodySplit - minBrandFrames);
  const bw = LONG_FORM_FALLBACK_BODY_WEIGHTS;
  const bwSum = bw.stats + bw.score + bw.trend + bw.outro;
  let statsF = Math.max(45, Math.floor((pool * bw.stats) / bwSum));
  let scoreF = Math.max(36, Math.floor((pool * bw.score) / bwSum));
  let trendF = Math.max(45, Math.floor((pool * bw.trend) / bwSum));
  let outroF = Math.max(45, Math.floor((pool * bw.outro) / bwSum));
  let brandF = bodySplit - statsF - scoreF - trendF - outroF;
  if (brandF < minBrandFrames) {
    const deficit = minBrandFrames - brandF;
    trendF = Math.max(45, trendF - deficit);
    brandF = bodySplit - statsF - scoreF - trendF - outroF;
  }

  let cursor = 60;

  const sIntro = cursor;
  cursor += intro;
  const sStats = cursor;
  cursor += statsF;
  const sScore = cursor;
  cursor += scoreF;
  const sTrend = cursor;
  cursor += trendF;
  const sOut = cursor;
  cursor += outroF;
  const sBrand = cursor;

  return (
    <>
      <Sequence from={0} durationInFrames={60}>
        <BrandBumper />
      </Sequence>
      <Sequence from={sIntro} durationInFrames={intro}>
        {renderIntroForDuration(intro)}
      </Sequence>
      <Sequence from={sStats} durationInFrames={statsF}>
        <StatCards market={marketName} stats={stats} />
      </Sequence>
      <Sequence from={sScore} durationInFrames={scoreF}>
        <ScoreReveal
          market={marketName}
          score={score}
          grade={grade}
          trend={trend}
          trendChange={trendChange}
          periodDate={periodDate}
          confidenceLetter={confidenceLetter}
        />
      </Sequence>
      <Sequence from={sTrend} durationInFrames={trendF}>
        {trendScene}
      </Sequence>
      <Sequence from={sOut} durationInFrames={outroF}>
        <Outro ctaUrl={ctaUrl} />
      </Sequence>
      <Sequence from={sBrand} durationInFrames={brandF}>
        <BrandOutroCard ctaUrl={ctaUrl} score={score} />
      </Sequence>
    </>
  );
};
