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

/** Legacy single-market props (kept for back-compat with existing data files). */
export interface LegacyVideoProps {
  mode: VideoMode;
  /** Primary (or only) market */
  primary: MarketData;
  /** Additional markets for comparison mode (1-2 more) */
  comparison?: ComparisonMarket[];
  /** Full UTM-tagged URL for the outro CTA */
  ctaUrl: string;
  /** Optional short text shown under the CTA URL */
  ctaLabel?: string;
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

export const VideoPropsSchema = z.object({
  format: z.enum([
    "grade_reveal",
    "top_10_ranking",
    "bottom_10_ranking",
    "score_mover",
    "head_to_head",
    "long_form_deep_dive",
    "farm_area_spotlight",
    "brokerage_market_share",
    "recruitment_angle",
  ]),
  resolvedMarket: z.object({
    canonical_name: z.string(),
    geography: z.enum(["state", "metro", "county", "zip"]),
    id: z.string(),
  }),
  dataBundle: z.any(),
  ctaUrl: z.string(),
  styleVariant: z.string().optional(),
  // Voiceover URL. When present, Remotion's <Audio> mounts it inside the
  // composition and the compositor muxes it into the output — no external
  // ffmpeg needed. Optional so silent renders (previews, smoke tests) work.
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
});

export type VideoProps = z.infer<typeof VideoPropsSchema>;
