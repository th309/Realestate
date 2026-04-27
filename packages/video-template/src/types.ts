/**
 * PropertyIQ Video Template Data Schema
 *
 * Maps to the PropertyIQ MCP `get_propertyiq_score` + `get_market_snapshot`
 * response shape. Pass this as --props=data.json to the Remotion renderer.
 */

import { z } from "zod";

export type ScoreTier =
  | "excellent"
  | "great"
  | "good"
  | "fair"
  | "average"
  | "below_avg"
  | "poor"
  | "very_poor";
export type TrendDirection = "up" | "down" | "stable";
export type VideoMode = "single" | "comparison";

export interface ScoreHistoryPoint {
  /** ISO date string: "2025-04-01" */
  date: string;
  score: number | null;
}

export interface MarketStats {
  /** Median home value in USD (Zillow ZHVI) */
  medianPrice: number;
  /** Home value year-over-year change percent (e.g. 0.36 = +0.36%) */
  homeValueYoyPct: number;
  /** Homeownership rate 0-100 */
  homeownershipPct: number;
  /** Metro-area population */
  population: number;
  /** Median household income in USD */
  medianIncome: number;
  /** Median rent in USD */
  medianRent: number;
}

export interface MarketData {
  /** Display name: "Austin, TX" */
  market: string;
  /** PropertyIQ Score 0-100 */
  score: number;
  /** Label: "GOOD", "EXCELLENT", etc. */
  grade: string;
  /** ISO date of score period */
  periodDate: string;
  trend: TrendDirection;
  /** Points changed vs prior period */
  trendChange: number;
  /** Up to 12 months of history for the trend chart */
  history: ScoreHistoryPoint[];
  stats: MarketStats;
}

export interface ComparisonMarket {
  market: string;
  score: number;
  grade: string;
  trend: TrendDirection;
  trendChange: number;
}

// Format configuration for the expanded content pipeline
// ---------------------------------------------------------------------------

export type FormatKey =
  | "grade_reveal"
  | "top_10_ranking"
  | "bottom_10_ranking"
  | "score_mover"
  | "head_to_head"
  | "long_form_deep_dive"
  | "farm_area_spotlight"
  | "brokerage_market_share"
  | "recruitment_angle";

export interface FormatConfig {
  key: FormatKey;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}

export const FORMAT_CONFIGS: Record<FormatKey, FormatConfig> = {
  grade_reveal: {
    key: "grade_reveal",
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 900,
  },
  top_10_ranking: {
    key: "top_10_ranking",
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 1800,
  },
  bottom_10_ranking: {
    key: "bottom_10_ranking",
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 1800,
  },
  score_mover: {
    key: "score_mover",
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 900,
  },
  head_to_head: {
    key: "head_to_head",
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 1800,
  },
  long_form_deep_dive: {
    key: "long_form_deep_dive",
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: 18000,
  },
  farm_area_spotlight: {
    key: "farm_area_spotlight",
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 1800,
  },
  brokerage_market_share: {
    key: "brokerage_market_share",
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 2250,
  },
  recruitment_angle: {
    key: "recruitment_angle",
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 2700,
  },
};

export interface ResolvedMarket {
  rank: number;
  region_id: string;
  region_name: string;
  state: string;
  value: number;
  value_formatted: string;
}

export interface RankingParams {
  format: "top_10_ranking" | "bottom_10_ranking";
  direction: "top" | "bottom";
  metric: { id: string; label: string; unit: string; format: string };
  scope: {
    type: "national" | "state" | "metro";
    id: string | null;
    label: string;
  };
  geo_level: "metro" | "county" | "zip";
  // Optional: the wizard captures `format_options.ranking` without as_of, and
  // no current layout reads it. Threading it end-to-end (resolver → wizard →
  // fetch-data → schema) is left for when somebody actually consumes the
  // data-freshness timestamp.
  as_of?: string;
  resolved_markets: ResolvedMarket[];
}

const ResolvedMarketSchema = z.object({
  rank: z.number(),
  region_id: z.string(),
  region_name: z.string(),
  state: z.string(),
  value: z.number(),
  value_formatted: z.string(),
});

const RankingParamsSchema = z.object({
  format: z.enum(["top_10_ranking", "bottom_10_ranking"]),
  direction: z.enum(["top", "bottom"]),
  metric: z.object({
    id: z.string(),
    label: z.string(),
    unit: z.string(),
    format: z.string(),
  }),
  scope: z.object({
    type: z.enum(["national", "state", "metro"]),
    id: z.string().nullable(),
    label: z.string(),
  }),
  geo_level: z.enum(["metro", "county", "zip"]),
  as_of: z.string().optional(),
  resolved_markets: z.array(ResolvedMarketSchema),
});

// VideoProps is a discriminated union by `format`:
//   - SingleMarketVideoProps: the legacy single-market shape with
//     `resolvedMarket`, used by Grade/ScoreMover/HeadToHead/FarmArea/etc.
//   - RankingVideoProps: ranking shape with `params: RankingParams` carrying
//     the N-market list, used by Top10Layout for top_10 / bottom_10.
//
// `.strict()` on each branch rejects fields that don't belong to that variant
// (e.g. a ranking object that accidentally carries `resolvedMarket`, or a
// score_mover object that accidentally carries `params`). `z.union` then
// picks whichever branch fully validates — TS narrows on `format` for free.

const ResolvedMarketShape = z.object({
  canonical_name: z.string(),
  geography: z.enum(["state", "metro", "county", "zip"]),
  id: z.string(),
});

// Voiceover URL. When present, Remotion's <Audio> mounts it inside the
// composition and the compositor muxes it into the output — no external
// ffmpeg needed. Optional so silent renders (previews, smoke tests) work.
const sharedShape = {
  ctaUrl: z.string(),
  styleVariant: z.string().optional(),
  audioUrl: z.string().url().optional(),
  captionWords: z
    .array(
      z.object({
        startMs: z.number(),
        endMs: z.number(),
        word: z.string(),
      }),
    )
    .optional(),
  /** Built at render time from script.sceneBreakdown + captions (long-form only). */
  longFormRenderPlan: z
    .object({
      durationInFrames: z.number().int().positive(),
      segments: z.array(
        z.object({
          kind: z.string(),
          fromFrame: z.number(),
          durationInFrames: z.number(),
          sceneKey: z.string().optional(),
          excerpt: z.string().optional(),
        }),
      ),
    })
    .optional(),
} as const;

const SINGLE_MARKET_FORMATS = [
  "grade_reveal",
  "score_mover",
  "head_to_head",
  "long_form_deep_dive",
  "farm_area_spotlight",
  "brokerage_market_share",
  "recruitment_angle",
] as const;

const RANKING_FORMATS = ["top_10_ranking", "bottom_10_ranking"] as const;

export const SingleMarketVideoPropsSchema = z
  .object({
    format: z.enum(SINGLE_MARKET_FORMATS),
    resolvedMarket: ResolvedMarketShape,
    dataBundle: z.any(),
    ...sharedShape,
  })
  .strict();

export const RankingVideoPropsSchema = z
  .object({
    format: z.enum(RANKING_FORMATS),
    params: RankingParamsSchema,
    // Mirror of `params` for back-compat with the few handlers that read
    // `dataBundle` blindly (render-thumbnail, future ranking gates). Optional
    // because the layout itself reads `params`.
    dataBundle: z.any().optional(),
    ...sharedShape,
  })
  .strict();

export const VideoPropsSchema = z.union([
  SingleMarketVideoPropsSchema,
  RankingVideoPropsSchema,
]);

export type SingleMarketVideoProps = z.infer<
  typeof SingleMarketVideoPropsSchema
>;
export type RankingVideoProps = z.infer<typeof RankingVideoPropsSchema>;
export type VideoProps = SingleMarketVideoProps | RankingVideoProps;
