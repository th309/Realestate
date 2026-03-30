/**
 * PropertyIQ Scoring Types
 *
 * Type definitions for the PropertyIQ scoring system.
 * Single score type: PropertyIQ Score — measures market demand signal
 * relative to state average using 3 Redfin metrics.
 *
 * Legacy score types (homeready, investoredge, markethealth) are preserved
 * as LegacyScoreType / AnyScoreType for backward compat when reading
 * historical rows from the propertyiq_scores table.
 */

// Re-export core types from formula-weights (using export type for isolatedModules)
export type {
  ScoreType,
  LegacyScoreType,
  AnyScoreType,
  GeographyLevel,
  ConfidenceLevel,
  MetricWeight,
  FormulaDefinition,
  ComponentGroupDefinition,
} from './formula-weights';

export {
  FORMULA_WEIGHTS,
  GRADE_THRESHOLDS,
  CONFIDENCE_LEVELS,
  ALERT_THRESHOLDS,
  FORMULA_VERSION,
  COMPONENT_GROUPS,
  scoreToGrade,
  getConfidenceLevel,
  getRequiredMetrics,
  validateFormulaWeights,
  // v4 demand-signal formula exports
  V4_FORMULA_METRICS,
  V4_METRIC_DIRECTIONS,
  V4_ZERO_CROSSING,
  V4_FORMULA_VERSION,
  V4_CALIBRATION,
} from './formula-weights';

// ============================================================================
// Component Breakdown Types
// ============================================================================

/**
 * Status label for a score component based on its normalized score.
 * Used in component breakdowns to provide quick-read assessments.
 */
export type ComponentStatus =
  | 'excellent'
  | 'strong'
  | 'moderate'
  | 'watch'
  | 'concern';

/**
 * Breakdown of a single component's contribution to an overall score.
 * Each score type is composed of 3-5 components (e.g., HomeReady has
 * affordability, market_timing, stability, growth_potential).
 */
export interface ScoreComponentBreakdown {
  /** Component name (e.g., 'affordability', 'market_timing') */
  component: string;
  /** Normalized component score (0-100) */
  score: number;
  /** Weight of this component in the overall score (0-1, sums to ~1.0) */
  weight: number;
  /** Quick-read status label based on score thresholds */
  status: ComponentStatus;
  /** Individual metrics that contribute to this component */
  contributing_metrics: {
    /** Metric name as used in FORMULA_WEIGHTS */
    metric: string;
    /** Standardized z-score for this metric */
    z_score: number;
    /** Whether higher values help (+1) or hurt (-1) the score */
    direction: 'positive' | 'negative';
    /** Raw metric value before standardization, null if unavailable */
    raw_value: number | null;
  }[];
}

/**
 * Extended score result that includes per-component breakdowns.
 * Returned when options.components === true on getScore().
 */
export interface ScoreWithComponents {
  score: number;
  grade: string;
  confidence: number;
  confidence_level: import('./formula-weights').ConfidenceLevel;
  components: ScoreComponentBreakdown[];
}

// ============================================================================
// Access Control Types
// ============================================================================

/**
 * Score access is driven entirely by the entitlements database (tier_features table).
 * Use the admin tiers page to change which tiers can access scores, breakdowns, and weights.
 * See scoring.guard.ts ScoreAccessService for the DB-driven access checks.
 */
export type ScoreAccess = 'full' | 'teaser';
export type UserTier = 'free' | 'basic' | 'pro' | 'enterprise';

// ============================================================================
// Core Types (moved here to avoid circular dependencies)
// ============================================================================

export type GeographyType = 'state' | 'metro' | 'county' | 'zip';

export interface LocationMetrics {
  location_id: string;
  location_name: string;
  median_price?: number;
  // Redfin market activity metrics
  rf_median_dom?: number;
  rf_off_market_in_two_weeks?: number;
  rf_sold_above_list?: number;
  rf_avg_sale_to_list?: number;
  rf_homes_sold_yoy?: number;
  rf_sold_above_list_yoy?: number;
  rf_avg_sale_to_list_yoy?: number;
  rf_median_dom_yoy?: number;
  // Census demographic metrics
  cen_median_age?: number;
  cen_population_yoy?: number;
  cen_income_yoy?: number;
  cen_homeownership_rate?: number;
  cen_rent_as_pct_of_income?: number;
  // Economic metrics
  econ_gdp_yoy?: number;
  // Zillow inventory (metro only)
  z_inventory?: number;
  // Calculated affordability metrics
  calc_income_to_buy?: number;
  // FRED macro indicators (national-level, same for all locations)
  fred_vix?: number;
  // Realtor listing metrics
  price_reduced_share?: number;
  pending_listing_count_yy?: number;
  // Track inherited metrics
  _inherited?: string[];
}

export interface ScoreResult {
  location_id: string;
  location_name: string;
  geography: import('./formula-weights').GeographyLevel;
  median_price: number | null;
  score_date: string;
  scores: {
    /** Primary score — v4 demand-signal PropertyIQ Score */
    propertyiq: SingleScoreResult | null;
    /** @deprecated Legacy v3 score — only populated when reading historical data */
    homeready?: SingleScoreResult | null;
    /** @deprecated Legacy v3 score — only populated when reading historical data */
    investoredge?: SingleScoreResult | null;
    /** @deprecated Legacy v3 score — only populated when reading historical data */
    markethealth?: SingleScoreResult | null;
  };
  /** Per-metric z-scores for this location (shared across all score types) */
  z_scores?: Record<string, number>;
  return_1y?: number;
  return_3y_ann?: number;
}

import {
  HISTORY_MONTHS_MAX,
  SCORE_HISTORY_YEARS_MAX,
} from '../common/history.constants';

/** Maximum months of history (shared across all data types). */
export const SCORE_HISTORY_MONTHS_MAX = HISTORY_MONTHS_MAX;

/** Maximum years of history for extended views. */
export { SCORE_HISTORY_YEARS_MAX };

/** One point in time for a single score type. */
export interface ScoreHistoryPoint {
  date: string;
  score: number | null;
}

/** History payload sent to frontend when historyMonths is requested. */
export interface ScoreHistoryResult {
  data: ScoreHistoryPoint[];
  months: number;
  trend: 'up' | 'down' | 'stable';
  change: number;
}

export interface SingleScoreResult {
  score: number;
  grade: string;
  confidence: number;
  confidence_level: import('./formula-weights').ConfidenceLevel;
  /** Change in score points vs prior period (e.g. +2.5 or -1.3) when history requested */
  trend_change?: number;
  /** Up to 6 months of history for real-time calculations when historyMonths requested */
  history?: ScoreHistoryResult;
  /** Per-component breakdown when options.components === true */
  components?: ScoreComponentBreakdown[];
}

// ============================================================================
// Legacy Types — REMOVED
// ============================================================================
// The following legacy types were removed in the v3 → v4 migration:
//   PropertyIQScore, HomeReadyComponentsLegacy, InvestorEdgeComponentsLegacy,
//   MarketHealthComponentsLegacy, ComponentScoreLegacy,
//   HOMEREADY_WEIGHTS, INVESTOREDGE_WEIGHTS, MARKET_HEALTH_WEIGHTS
// If you need to read old data, use AnyScoreType from formula-weights.ts.

// ============================================================================
// Scoring Constants
// ============================================================================

export const SCORING_CONSTANTS = {
  MIN_SCORE: 0,
  MAX_SCORE: 100,
  TREND_MONTHS: 3,
  TREND_THRESHOLD: 5,
  HIGH_CONFIDENCE_METRICS_PCT: 0.9,
  HIGH_CONFIDENCE_FRESHNESS_DAYS: 60,
  MEDIUM_CONFIDENCE_METRICS_PCT: 0.7,
  MEDIUM_CONFIDENCE_FRESHNESS_DAYS: 120,
  MODERATE_TARGET_PERCENTILE: 50,
  SCORE_AVAILABLE_MIN_COMPLETENESS: 50, // Minimum % of data required for score
  PARTIAL_SCORE_THRESHOLD: 80, // Below this, score is marked as "partial"
};

// ============================================================================
// Utility Types
// ============================================================================

export interface MetricValue {
  value: number | null;
  date: string;
  source: string;
}

export interface MetricData {
  [metricName: string]: MetricValue;
}

export interface CalculatedMetrics {
  geographyId: string;
  geographyType: string;
  periodDate: string;
  grm: number | null;
  rentPriceRatio: number | null;
  capRateProxy: number | null;
  priceRentRatio: number | null;
  zhviYoyChange: number | null;
  zoriYoyChange: number | null;
  inventoryYoyChange: number | null;
  zhvi3yChange: number | null;
  zhvi5yChange: number | null;
  zhvi90dChange: number | null;
  zori90dChange: number | null;
  inventory90dChange: number | null;
  dom90dChange: number | null;
  zhviStddev12m: number | null;
  zhviStddev36m: number | null;
  zoriStddev12m: number | null;
  inventoryStddev12m: number | null;
  domStddev12m: number | null;
  monthsOfSupply: number | null;
}

export interface MetricPercentiles {
  metricName: string;
  geographyType: string;
  periodDate: string;
  p10: number;
  p20: number;
  p30: number;
  p40: number;
  p50: number;
  p60: number;
  p70: number;
  p80: number;
  p90: number;
  min: number;
  max: number;
  count: number;
  mean: number;
  stddev: number;
}

// Legacy metric definitions (HOMEREADY_DETAILED_METRICS, INVESTOREDGE_DETAILED_METRICS,
// MARKET_HEALTH_DETAILED_METRICS) were removed in the v3 → v4 migration.
