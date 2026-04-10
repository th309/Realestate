/**
 * PropertyIQ Video Template — Data Schema
 *
 * Maps to the PropertyIQ MCP `get_propertyiq_score` + `get_market_snapshot`
 * response shape. Pass this as --props=data.json to the Remotion renderer.
 */

export type ScoreTier = "excellent" | "great" | "good" | "fair" | "average" | "below_avg" | "poor" | "very_poor";
export type TrendDirection = "up" | "down" | "stable";
export type VideoMode = "single" | "comparison";

export interface ScoreHistoryPoint {
  /** ISO date string: "2025-04-01" */
  date: string;
  score: number | null;
}

export interface MarketStats {
  /** Zillow ZHVI median home value in USD */
  medianPrice: number;
  /** Zillow average days on market */
  daysOnMarket: number;
  /** PropertyIQ demand component score 0-100 */
  demandScore: number;
  /** Pending listings / total listings ratio 0-1 */
  pendingRatio: number;
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

export interface VideoProps {
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
