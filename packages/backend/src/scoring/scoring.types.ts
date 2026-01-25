/**
 * PropertyIQ Scoring Types
 *
 * Simplified type definitions for the fixed-formula scoring system.
 * The scoring methodology uses z-score standardization with ML-derived weights.
 *
 * Score Types:
 * - HomeReady: Predicts 3-year price appreciation for homebuyers
 * - InvestorEdge: Predicts total return for investors
 * - MarketHealth: Current market conditions
 */

// Re-export core types from formula-weights (using export type for isolatedModules)
export type {
  ScoreType,
  GeographyLevel,
  ConfidenceLevel,
  MetricWeight,
  FormulaDefinition,
} from './formula-weights';

export {
  FORMULA_WEIGHTS,
  GRADE_THRESHOLDS,
  MODEL_CORRELATIONS,
  SAMPLE_SIZE_SCORES,
  CONFIDENCE_LEVELS,
  ALERT_THRESHOLDS,
  FORMULA_VERSION,
  scoreToGrade,
  getConfidenceLevel,
  getRequiredMetrics,
  validateFormulaWeights,
} from './formula-weights';

// ============================================================================
// Access Control Types
// ============================================================================

export type ScoreAccess = 'full' | 'teaser';
export type UserTier = 'free' | 'basic' | 'pro' | 'enterprise';

/**
 * Score access configuration by tier
 */
export const SCORE_ACCESS_CONFIG: Record<import('./formula-weights').ScoreType, UserTier[]> = {
  markethealth: ['free', 'basic', 'pro', 'enterprise'], // Available to all
  homeready: ['pro', 'enterprise'], // Pro+ only
  investoredge: ['pro', 'enterprise'], // Pro+ only
};

// ============================================================================
// Core Types (moved here to avoid circular dependencies)
// ============================================================================

export type GeographyType = 'state' | 'metro' | 'county' | 'zip';

export interface LocationMetrics {
  location_id: string;
  location_name: string;
  median_price?: number;
  // Realtor metrics
  hotness_score?: number;
  demand_score?: number;
  pending_ratio?: number;
  price_reduced_share?: number;
  active_listing_count_yy?: number;
  price_reduced_count_yy?: number;
  // Census/Economic metrics (may be inherited for ZIP)
  population_yoy?: number;
  unemployment_rate_yoy?: number;
  median_gross_rent?: number;
  homeownership_rate?: number;
  affordability_ratio?: number;
  rent_price_ratio?: number;
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
    homeready: SingleScoreResult;
    investoredge: SingleScoreResult;
    markethealth: SingleScoreResult;
  };
  return_1y?: number;
  return_3y_ann?: number;
}

import { HISTORY_MONTHS_MAX } from '../common/history.constants';

/** Maximum months of history (shared across all data types). */
export const SCORE_HISTORY_MONTHS_MAX = HISTORY_MONTHS_MAX;

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
}

// ============================================================================
// Legacy Types (for backwards compatibility)
// ============================================================================

/**
 * @deprecated Use ScoreResult from scoring.service instead
 */
export interface PropertyIQScore {
  geographyId: string;
  geographyType: string;
  geographyName: string;
  stateCode: string | null;
  periodDate: string;

  // Market Health (0-100)
  marketHealthScore: number | null;
  marketHealthComponents: MarketHealthComponentsLegacy | null;
  marketHealthTrend: 'up' | 'down' | 'stable';
  marketHealthTrendChange: number;

  // HomeReady (0-100)
  homereadyScore: number;
  homereadyComponents: HomeReadyComponentsLegacy;
  homereadyTrend: 'up' | 'down' | 'stable';
  homereadyTrendChange: number;

  // InvestorEdge (0-100)
  investoredgeScore: number;
  investoredgeComponents: InvestorEdgeComponentsLegacy;
  investoredgeTrend: 'up' | 'down' | 'stable';
  investoredgeTrendChange: number;

  // Confidence
  confidenceLevel: 'high' | 'medium' | 'low';
  metricsAvailable: number;
  metricsTotal: number;
  dataFreshnessDays: number;

  // Data completeness
  dataCompleteness: number;
  inheritedMetrics: Record<string, string>;

  calculatedAt: string;
  calculationVersion: string;
}

/**
 * @deprecated Legacy component structure
 */
export interface HomeReadyComponentsLegacy {
  affordability: ComponentScoreLegacy;
  market_timing: ComponentScoreLegacy;
  stability: ComponentScoreLegacy;
  growth_potential: ComponentScoreLegacy;
  livability: ComponentScoreLegacy;
}

/**
 * @deprecated Legacy component structure
 */
export interface InvestorEdgeComponentsLegacy {
  cash_flow: ComponentScoreLegacy;
  rent_demand: ComponentScoreLegacy;
  appreciation: ComponentScoreLegacy;
  entry_point: ComponentScoreLegacy;
  risk: ComponentScoreLegacy;
}

/**
 * @deprecated Legacy component structure
 */
export interface MarketHealthComponentsLegacy {
  demand_strength: ComponentScoreLegacy;
  supply_balance: ComponentScoreLegacy;
  price_stability: ComponentScoreLegacy;
  economic_foundation: ComponentScoreLegacy;
}

/**
 * @deprecated Legacy component score
 */
export interface ComponentScoreLegacy {
  score: number;
  weight: number;
  weightedContribution: number;
  metricsUsed: string[];
  helpingFactors: string[];
  hurtingFactors: string[];
}

// Type aliases for backwards compatibility (non-legacy names)
export type HomeReadyComponents = HomeReadyComponentsLegacy;
export type InvestorEdgeComponents = InvestorEdgeComponentsLegacy;
export type MarketHealthComponents = MarketHealthComponentsLegacy;
export type ComponentScore = ComponentScoreLegacy;

// ============================================================================
// Legacy Weights (kept for any code that might reference them)
// ============================================================================

/**
 * @deprecated Use FORMULA_WEIGHTS from formula-weights.ts instead
 */
export const HOMEREADY_WEIGHTS = {
  affordability: 0.3,
  market_timing: 0.25,
  stability: 0.2,
  growth_potential: 0.15,
  livability: 0.1,
};

/**
 * @deprecated Use FORMULA_WEIGHTS from formula-weights.ts instead
 */
export const INVESTOREDGE_WEIGHTS = {
  cash_flow: 0.35,
  rent_demand: 0.2,
  appreciation: 0.2,
  entry_point: 0.15,
  risk: 0.1,
};

/**
 * @deprecated Use FORMULA_WEIGHTS from formula-weights.ts instead
 */
export const MARKET_HEALTH_WEIGHTS = {
  demand_strength: 0.35,
  supply_balance: 0.25,
  price_stability: 0.25,
  economic_foundation: 0.15,
};

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

// ============================================================================
// Legacy Metric Definitions (for reference only)
// ============================================================================

export type MetricDirection = 'higher_better' | 'lower_better' | 'moderate_better' | 'neutral';
export type NullStrategy = 'skip' | 'neutral' | 'penalize';

export interface MetricDefinition {
  name: string;
  direction: MetricDirection;
  weight: number;
  nullStrategy: NullStrategy;
  description?: string;
}

/**
 * @deprecated Use FORMULA_WEIGHTS from formula-weights.ts
 * These empty arrays prevent compile errors in any legacy code
 */
export const HOMEREADY_DETAILED_METRICS: Record<string, MetricDefinition[]> = {
  affordability: [],
  market_timing: [],
  stability: [],
  growth_potential: [],
  livability: [],
};

/**
 * @deprecated Use FORMULA_WEIGHTS from formula-weights.ts
 */
export const INVESTOREDGE_DETAILED_METRICS: Record<string, MetricDefinition[]> = {
  cash_flow: [],
  rent_demand: [],
  appreciation: [],
  entry_point: [],
  risk: [],
};

/**
 * @deprecated Use FORMULA_WEIGHTS from formula-weights.ts
 */
export const MARKET_HEALTH_DETAILED_METRICS: Record<string, MetricDefinition[]> = {
  demand_strength: [],
  supply_balance: [],
  price_stability: [],
  economic_foundation: [],
};
