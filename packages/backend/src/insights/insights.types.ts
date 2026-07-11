/**
 * Types for the AI Insights module.
 *
 * Defines the data structures used to generate, store, and serve
 * AI-generated market insights (market takes, score explanations, etc.).
 */

export type InsightType =
  | 'market_take'
  | 'score_explanation'
  | 'trend_interpretation'
  | 'market_overview'
  | 'archetype_match'
  | 'market_outlook';

export type GeoLevel = 'state' | 'metro' | 'county' | 'zip';

/** Row shape matching the `market_insights` database table. */
export interface MarketInsight {
  id: string;
  region_id: string;
  geo_level: GeoLevel;
  insight_type: InsightType;
  content: string;
  model: string;
  archetype_id: string | null;
  generated_at: string;
  expires_at: string;
}

/**
 * Context object assembled from scores, metrics, and benchmarks
 * that gets injected into every AI prompt template.
 */
export interface InsightContext {
  region_name: string;
  region_id: string;
  geo_level: GeoLevel;
  scores: {
    propertyiq: number | null;
    /** A/B/C/F data-quality grade for the score; null when unavailable. */
    confidence_level: string | null;
  };
  score_components: Record<string, { status: string; value: number }>;
  key_metrics: Record<
    string,
    { value: number | null; yoy_change: number | null; format: string }
  >;
  benchmarks: {
    state_avg: Record<string, number>;
    national_avg: Record<string, number>;
  };
}
