import React from "react";
import { AbsoluteFill, Series } from "remotion";
import type { VideoProps } from "../types";
import { TIMING } from "../constants";
import { Intro } from "../scenes/Intro";
import { ScoreReveal } from "../scenes/ScoreReveal";
import { TrendChart } from "../scenes/TrendChart";
import { StatCards } from "../scenes/StatCards";
import { Comparison } from "../scenes/Comparison";
import { Outro } from "../scenes/Outro";

interface PropertyIQVideoProps extends VideoProps {
  isVertical?: boolean;
}

/**
 * Main video composition.
 *
 * Scenes play in sequence via Remotion's <Series> component.
 * Comparison scene is included when mode === "comparison".
 */
export const PropertyIQVideo: React.FC<PropertyIQVideoProps> = ({
  mode,
  primary,
  comparison,
  ctaUrl,
  ctaLabel,
  isVertical,
}) => {
  const hasComparison = mode === "comparison" && comparison && comparison.length > 0;
  const outroDuration = TIMING.outro.duration;

  return (
    <AbsoluteFill>
      <Series>
        {/* 1. Intro — 2s */}
        <Series.Sequence durationInFrames={TIMING.intro.duration}>
          <Intro marketName={primary.market} isVertical={isVertical} />
        </Series.Sequence>

        {/* 2. Score Reveal — 7s */}
        <Series.Sequence durationInFrames={TIMING.scoreReveal.duration}>
          <ScoreReveal
            market={primary.market}
            score={primary.score}
            grade={primary.grade}
            trend={primary.trend}
            trendChange={primary.trendChange}
            periodDate={primary.periodDate}
            isVertical={isVertical}
          />
        </Series.Sequence>

        {/* 3. Trend Chart — 8s */}
        <Series.Sequence durationInFrames={TIMING.trendChart.duration}>
          <TrendChart
            market={primary.market}
            history={primary.history}
            currentScore={primary.score}
            isVertical={isVertical}
          />
        </Series.Sequence>

        {/* 4. Stat Cards — 9s */}
        <Series.Sequence durationInFrames={TIMING.statCards.duration}>
          <StatCards
            market={primary.market}
            stats={primary.stats}
            isVertical={isVertical}
          />
        </Series.Sequence>

        {/* 5. Comparison — 10s (only in comparison mode) */}
        {hasComparison && (
          <Series.Sequence durationInFrames={TIMING.comparison.duration}>
            <Comparison
              primary={primary}
              others={comparison!}
              isVertical={isVertical}
            />
          </Series.Sequence>
        )}

        {/* 6. Outro — 7s */}
        <Series.Sequence durationInFrames={outroDuration}>
          <Outro ctaUrl={ctaUrl} ctaLabel={ctaLabel} isVertical={isVertical} />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
