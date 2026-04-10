import React from "react";
import { Composition, registerRoot } from "remotion";
import { PropertyIQVideo } from "./compositions/PropertyIQVideo";
import {
  TOTAL_DURATION_SINGLE,
  TOTAL_DURATION_COMPARISON,
  LANDSCAPE,
  VERTICAL,
  FPS,
} from "./constants";
import type { VideoProps } from "./types";

/**
 * Default props for Remotion Studio preview.
 * Override entirely by passing --props=data.json at render time.
 */
const defaultProps: VideoProps = {
  mode: "single",
  primary: {
    market: "Austin, TX",
    score: 74,
    grade: "GOOD",
    periodDate: "2026-03-01",
    trend: "up",
    trendChange: 3,
    history: [
      { date: "2025-04-01", score: 64 },
      { date: "2025-05-01", score: 66 },
      { date: "2025-06-01", score: 67 },
      { date: "2025-07-01", score: 65 },
      { date: "2025-08-01", score: 68 },
      { date: "2025-09-01", score: 69 },
      { date: "2025-10-01", score: 70 },
      { date: "2025-11-01", score: 71 },
      { date: "2025-12-01", score: 72 },
      { date: "2026-01-01", score: 70 },
      { date: "2026-02-01", score: 71 },
      { date: "2026-03-01", score: 74 },
    ],
    stats: {
      medianPrice: 485000,
      daysOnMarket: 28,
      demandScore: 72,
      pendingRatio: 0.68,
    },
  },
  ctaUrl:
    "https://propertyiq.app/market/austin-tx?utm_source=youtube&utm_medium=video&utm_campaign=market-reveal",
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/*
       * StudioComposition — 1920x1080 landscape
       * This is the primary render target referenced in the CMO skill (Step 7b).
       * Render: npx remotion render StudioComposition out.mp4 --props=data.json
       */}
      <Composition
        id="StudioComposition"
        component={PropertyIQVideo}
        durationInFrames={TOTAL_DURATION_COMPARISON}
        fps={FPS}
        width={LANDSCAPE.width}
        height={LANDSCAPE.height}
        defaultProps={defaultProps}
        calculateMetadata={({ props }) => {
          const duration =
            props.mode === "comparison"
              ? TOTAL_DURATION_COMPARISON
              : TOTAL_DURATION_SINGLE;
          return { durationInFrames: duration };
        }}
      />

      {/*
       * ShortsComposition — 1080x1920 vertical (YouTube Shorts / TikTok / Reels)
       * Render: npx remotion render ShortsComposition out-shorts.mp4 --props=data.json
       */}
      <Composition
        id="ShortsComposition"
        component={(props) => <PropertyIQVideo {...props} isVertical />}
        durationInFrames={TOTAL_DURATION_COMPARISON}
        fps={FPS}
        width={VERTICAL.width}
        height={VERTICAL.height}
        defaultProps={defaultProps}
        calculateMetadata={({ props }) => {
          const duration =
            props.mode === "comparison"
              ? TOTAL_DURATION_COMPARISON
              : TOTAL_DURATION_SINGLE;
          return { durationInFrames: duration };
        }}
      />
    </>
  );
};

registerRoot(RemotionRoot);
