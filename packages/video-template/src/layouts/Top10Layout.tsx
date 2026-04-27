import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { BrandBumper } from "../primitives/BrandBumper";
import { BrandOutroCard } from "../primitives/BrandOutroCard";
import { CornerBug } from "../primitives/CornerBug";
import { HeroRow } from "../primitives/HeroRow";
import { HookHeadline } from "../primitives/HookHeadline";
import { MeshBackground } from "../primitives/MeshBackground";
import { OutroSummary } from "../primitives/OutroSummary";
import { RankStack } from "../primitives/RankStack";
import type { RankingVideoProps } from "../types";
import {
  BRAND_OUTRO_FRAMES,
  BUMPER_FRAMES,
  computeRankingTiming,
  formatAsOf,
  shortenLabel,
} from "./top10-timing";

const ACCENT_BY_THEME = {
  top: "#00C853",
  bottom: "#FF8F00",
} as const;

const LABEL_BY_THEME = {
  top: "TOP 10",
  bottom: "BOTTOM 10",
} as const;

const HEADLINE_BY_THEME = {
  top: "TOP MARKETS",
  bottom: "MARKETS TO AVOID",
} as const;

type Top10LayoutProps = RankingVideoProps & {
  theme?: "top" | "bottom";
};

/**
 * Editorial broadcast layout for ranking countdowns. Composes:
 *
 *   - MeshBackground       persistent indigo atmosphere + grid + vignette
 *   - BrandBumper          0–60 frames, brand sting
 *   - CornerBug            persistent broadcast tag (top-left) after bumper
 *   - HookHeadline         intro window before the first "Number N." word
 *   - HeroRow × N          each rank's reveal, anchored to caption timing
 *   - RankStack            sliding 3-row history, dock on right edge
 *   - OutroSummary         all-ranks recap during the outro VO
 *   - BrandOutroCard       closing card after audio ends
 *
 * Per-row reveals align to the audio's actual word timings via
 * computeRankingTiming(captionWords) — the synthesizer (Edge native, Azure
 * via Edge shadow capture, or Whisper transcription) publishes word-level
 * startMs values, and the layout finds each "Number" word and uses its frame
 * as the row's <Sequence> from-prop. Falls back to even-spaced 3.5s reveals
 * if captions are unavailable.
 */
export const Top10Layout: React.FC<Top10LayoutProps> = (props) => {
  const theme = props.theme ?? "top";
  const accent = ACCENT_BY_THEME[theme];
  const themeLabel = LABEL_BY_THEME[theme];
  const headline = HEADLINE_BY_THEME[theme];

  const { params } = props;
  const metricLabel = params.metric.label;
  const scopeLabel = params.scope.label.toUpperCase();
  const asOf = params.as_of ? formatAsOf(params.as_of) : undefined;

  // Reveal cadence: count down #N → #1, so ordered[0] is the lowest-rank
  // market the audience sees first.
  const ordered = [...params.resolved_markets].slice(0, 10).reverse();
  const timing = computeRankingTiming(ordered.length, props.captionWords);
  const totalFrames = timing.totalFrames + BRAND_OUTRO_FRAMES;

  return (
    <AbsoluteFill>
      <MeshBackground />

      <Sequence from={0} durationInFrames={BUMPER_FRAMES}>
        <BrandBumper />
      </Sequence>

      <Sequence
        from={BUMPER_FRAMES}
        durationInFrames={totalFrames - BUMPER_FRAMES}
      >
        <CornerBug
          label={`${themeLabel} ${shortenLabel(metricLabel)}`}
          scope={scopeLabel}
          asOf={asOf}
        />
      </Sequence>

      <Sequence
        from={timing.hookStartFrame}
        durationInFrames={Math.max(1, timing.hookDurationFrames)}
      >
        <HookHeadline headline={headline} scope={scopeLabel} accent={accent} />
      </Sequence>

      {ordered.map((market, i) => {
        const fromFrame = timing.rowStartFrames[i];
        const nextStart =
          timing.rowStartFrames[i + 1] ?? timing.outroStartFrame;
        const duration = Math.max(1, nextStart - fromFrame);
        const history = ordered.slice(0, i).map((m) => ({
          rank: m.rank,
          marketName: m.region_name,
          state: m.state,
          valueFormatted: m.value_formatted,
        }));
        return (
          <Sequence
            key={market.region_id}
            from={fromFrame}
            durationInFrames={duration}
          >
            <HeroRow
              rank={market.rank}
              marketName={market.region_name}
              state={market.state}
              valueFormatted={market.value_formatted}
              metricLabel={metricLabel}
              accent={accent}
            />
            <RankStack history={history} windowSize={3} accent={accent} />
          </Sequence>
        );
      })}

      <Sequence
        from={timing.outroStartFrame}
        durationInFrames={Math.max(1, timing.outroDurationFrames)}
      >
        <OutroSummary
          markets={ordered}
          accent={accent}
          themeLabel={themeLabel}
        />
      </Sequence>

      <Sequence from={timing.totalFrames} durationInFrames={BRAND_OUTRO_FRAMES}>
        <BrandOutroCard ctaUrl={props.ctaUrl} />
      </Sequence>
    </AbsoluteFill>
  );
};
