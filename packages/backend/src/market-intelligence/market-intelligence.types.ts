/**
 * Market Intelligence Types
 *
 * Shared type definitions for the market intelligence layer:
 * briefings, news, rankings, and metric constants.
 */

import type { MarketStance, StanceSignal } from './engines/market-stance.engine';
import type { RiskFlag } from './engines/risk-flags.engine';

// Re-export engine types for convenience
export type { MarketStance, StanceSignal } from './engines/market-stance.engine';
export type { RiskFlag } from './engines/risk-flags.engine';

/** Snapshot of a single metric value within a briefing */
export interface MetricSnapshot {
  value: number | null;
  formatted: string;
  mom_change: number | null;
  yoy_change: number | null;
  date: string | null;
  source: string;
  is_inherited: boolean;
}

/** Snapshot of a score within a briefing */
export interface ScoreSnapshot {
  score: number;
  confidence: string; // A | B | C | F
  trend: 'up' | 'down' | 'stable';
  change_30d: number;
}

/** A news article associated with a market */
export interface NewsItem {
  headline: string;
  source_name: string;
  published_at: string;
  summary: string;
  tags: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
}

/** A complete market briefing — the core intelligence document */
export interface MarketBriefing {
  id: string;
  geography_id: string;
  geography_type: 'metro' | 'county';
  geography_name: string;
  generated_date: string;

  metrics_snapshot: Record<string, MetricSnapshot>;
  scores: Record<string, ScoreSnapshot>;

  market_stance: MarketStance;
  stance_signals: StanceSignal[];
  risk_flags: RiskFlag[];

  narrative_summary: string;
  suggested_questions: string[];
  news_snapshot: NewsItem[];

  metrics_count: number;
  data_freshness_days: number;
  generation_time_ms?: number;
}

/** A market news article stored in the database */
export interface MarketNewsRecord {
  id: string;
  url: string;
  headline: string;
  source_name: string;
  published_at: string;
  summary: string;
  tags: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
  geography_ids: string[];
  geography_type: string;
  geo_tag_confidence: number;
  raw_description: string;
  ingested_at: string;
}

/** A cached ranking entry */
export interface RankingEntry {
  geography_id: string;
  geography_name: string;
  value: number;
  formatted: string;
  rank: number;
}

/** A rankings cache record from the database */
export interface RankingsCacheRecord {
  id: string;
  metric_id: string;
  geography_type: 'metro' | 'county' | 'state';
  direction: 'top' | 'bottom';
  rank_count: number;
  generated_date: string;
  is_latest: boolean;
  rankings: RankingEntry[];
}

/** National benchmark values used by stance and risk engines */
export interface NationalBenchmarks {
  vacancy_rate: number;
  appreciation_yoy: number;
  unemployment_rate: number;
}

/** Default national benchmarks used when live data is unavailable */
export const DEFAULT_NATIONAL_BENCHMARKS: NationalBenchmarks = {
  vacancy_rate: 6.4,
  appreciation_yoy: 3.5,
  unemployment_rate: 3.7,
};

/** Metrics needed for briefing generation */
export const BRIEFING_METRIC_IDS = [
  'home_value',
  'appreciation_yoy',
  'rent_index',
  'rent_growth_yoy',
  'cap_rate',
  'vacancy_rate',
  'population',
  'population_growth',
  'unemployment_rate',
  'median_income',
  'dom',
  'inventory',
  'price_to_rent',
  'permits_growth',
  'price_to_income',
] as const;

/** Metrics pre-computed for rankings cache */
export const RANKINGS_METRIC_IDS = [
  'home_value',
  'appreciation_yoy',
  'rent_index',
  'cap_rate',
  'vacancy_rate',
  'population_growth',
  'unemployment_rate',
  'dom',
  'inventory',
  'price_to_rent',
  'permits_growth',
  'median_income',
] as const;

export type BriefingMetricId = (typeof BRIEFING_METRIC_IDS)[number];
export type RankingsMetricId = (typeof RANKINGS_METRIC_IDS)[number];
