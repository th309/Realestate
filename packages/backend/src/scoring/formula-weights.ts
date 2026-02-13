/**
 * PropertyIQ Scoring System - Fixed Formula Weights
 *
 * These weights come from machine learning analysis and are fixed.
 * They define how each metric contributes to the final score.
 *
 * Direction:
 *   +1 = higher values are better (positive contribution)
 *   -1 = lower values are better (negative contribution)
 *
 * Weight:
 *   Percentage contribution to the total score (0-1)
 */

export type ScoreType = 'homeready' | 'investoredge' | 'markethealth';
export type GeographyLevel = 'metro' | 'county' | 'zip';

export interface MetricWeight {
  weight: number;
  direction: 1 | -1;
}

export interface FormulaDefinition {
  [metricName: string]: MetricWeight;
}

export interface GeographyFormulas {
  homeready: FormulaDefinition;
  investoredge: FormulaDefinition;
  markethealth: FormulaDefinition;
}

/**
 * Fixed formula weights for all geography levels and score types.
 * v2.0: Optimized via walk-forward elastic net CV on excess returns vs division/state/metro benchmarks.
 * All bootstrap tests significant (95% CI excludes 0).
 */
export const FORMULA_WEIGHTS: Record<GeographyLevel, GeographyFormulas> = {
  // ===================
  // METRO LEVEL FORMULAS (OOS IC: HR=0.26, IE=0.52)
  // ===================
  metro: {
    // HomeReady (Metro): Predicts 3Y excess appreciation vs census division median
    homeready: {
      median_days_on_market: { weight: 0.204, direction: -1 },
      demand_score: { weight: 0.203, direction: 1 },
      hotness_score: { weight: 0.169, direction: -1 },
      affordability_ratio: { weight: 0.128, direction: 1 },
      price_reduced_share: { weight: 0.099, direction: -1 },
      pending_ratio: { weight: 0.072, direction: 1 },
      unemployment_rate_yoy: { weight: 0.065, direction: -1 },
      population_yoy: { weight: 0.060, direction: 1 },
    },
    // InvestorEdge (Metro): Predicts 3Y excess total return vs division median
    investoredge: {
      median_days_on_market: { weight: 0.226, direction: -1 },
      median_gross_rent: { weight: 0.200, direction: 1 },
      supply_score: { weight: 0.160, direction: -1 },
      demand_score: { weight: 0.101, direction: 1 },
      pending_ratio: { weight: 0.098, direction: 1 },
      population_yoy: { weight: 0.089, direction: 1 },
      homeownership_rate: { weight: 0.064, direction: -1 },
      price_reduced_share: { weight: 0.061, direction: -1 },
    },
    // MarketHealth (Metro): Current market conditions (not optimized - concurrent indicator)
    markethealth: {
      hotness_score: { weight: 0.416, direction: 1 },
      demand_score: { weight: 0.345, direction: 1 },
      pending_ratio: { weight: 0.239, direction: 1 },
    },
  },

  // ===================
  // COUNTY LEVEL FORMULAS (OOS IC: HR=0.20, IE=0.20)
  // ===================
  county: {
    // HomeReady (County): Predicts 3Y excess appreciation vs state median
    homeready: {
      median_days_on_market: { weight: 0.227, direction: -1 },
      pending_ratio: { weight: 0.207, direction: 1 },
      population_yoy: { weight: 0.192, direction: 1 },
      demand_score: { weight: 0.114, direction: 1 },
      affordability_ratio: { weight: 0.109, direction: 1 },
      supply_score: { weight: 0.080, direction: -1 },
      price_reduced_share: { weight: 0.048, direction: 1 },
      unemployment_rate_yoy: { weight: 0.024, direction: 1 },
    },
    // InvestorEdge (County): Predicts 3Y excess total return vs state median
    investoredge: {
      median_days_on_market: { weight: 0.220, direction: -1 },
      population_yoy: { weight: 0.192, direction: 1 },
      pending_ratio: { weight: 0.189, direction: 1 },
      demand_score: { weight: 0.118, direction: 1 },
      affordability_ratio: { weight: 0.105, direction: 1 },
      supply_score: { weight: 0.081, direction: -1 },
      median_gross_rent: { weight: 0.050, direction: 1 },
      homeownership_rate: { weight: 0.046, direction: -1 },
    },
    // MarketHealth (County): Current market conditions (not optimized)
    markethealth: {
      hotness_score: { weight: 0.533, direction: 1 },
      demand_score: { weight: 0.254, direction: 1 },
      pending_ratio: { weight: 0.213, direction: 1 },
    },
  },

  // ===================
  // ZIP LEVEL FORMULAS (OOS IC: HR=0.15, IE=0.17)
  // ===================
  zip: {
    // HomeReady (ZIP): Predicts 3Y excess appreciation vs metro median
    homeready: {
      demand_score: { weight: 0.458, direction: 1 },
      median_days_on_market: { weight: 0.269, direction: -1 },
      pending_ratio: { weight: 0.232, direction: 1 },
      affordability_ratio: { weight: 0.042, direction: 1 },
    },
    // InvestorEdge (ZIP): Predicts 3Y excess total return vs metro median
    investoredge: {
      demand_score: { weight: 0.293, direction: 1 },
      median_days_on_market: { weight: 0.216, direction: -1 },
      homeownership_rate: { weight: 0.191, direction: 1 },
      pending_ratio: { weight: 0.181, direction: 1 },
      hotness_score: { weight: 0.048, direction: 1 },
      median_gross_rent: { weight: 0.041, direction: 1 },
      price_reduced_share: { weight: 0.029, direction: 1 },
    },
    // MarketHealth (ZIP): Current market conditions (not optimized)
    markethealth: {
      hotness_score: { weight: 0.699, direction: 1 },
      demand_score: { weight: 0.301, direction: 1 },
    },
  },
};

/**
 * Grade thresholds for converting scores (0-100) to letter grades.
 * Adjusted for percentile-rank normalization (uniform distribution):
 *   A+ = top 5%, A = top 10%, A- = top 15%, B+ = top 20%, etc.
 * Ordered from highest to lowest for efficient lookup.
 */
export const GRADE_THRESHOLDS: Array<{ min: number; grade: string }> = [
  { min: 95, grade: 'A+' },
  { min: 90, grade: 'A' },
  { min: 85, grade: 'A-' },
  { min: 80, grade: 'B+' },
  { min: 70, grade: 'B' },
  { min: 65, grade: 'B-' },
  { min: 55, grade: 'C+' },
  { min: 45, grade: 'C' },
  { min: 35, grade: 'C-' },
  { min: 30, grade: 'D+' },
  { min: 20, grade: 'D' },
  { min: 10, grade: 'D-' },
  { min: 0, grade: 'F' },
];

/**
 * Model correlation values from walk-forward OOS validation.
 * Used in confidence calculation (Model Strength factor = correlation × 125, capped at 100).
 * v2.0: Updated from walk-forward elastic net OOS IC (Spearman rank correlation).
 */
export const MODEL_CORRELATIONS: Record<
  GeographyLevel,
  Record<ScoreType, number>
> = {
  metro: {
    homeready: 0.26,     // OOS IC from walk-forward CV
    investoredge: 0.52,  // OOS IC from walk-forward CV
    markethealth: 0.56,  // Kept from v1.0 (concurrent indicator)
  },
  county: {
    homeready: 0.20,     // OOS IC from walk-forward CV
    investoredge: 0.20,  // OOS IC from walk-forward CV
    markethealth: 0.29,  // Kept from v1.0
  },
  zip: {
    homeready: 0.15,     // OOS IC from walk-forward CV
    investoredge: 0.17,  // OOS IC from walk-forward CV
    markethealth: 0.26,  // Kept from v1.0
  },
};

/**
 * Sample size scores for confidence calculation.
 * Higher scores indicate more reliable data at that geography level.
 */
export const SAMPLE_SIZE_SCORES: Record<GeographyLevel, number> = {
  metro: 60,
  county: 80,
  zip: 100,
};

/**
 * Confidence level thresholds.
 */
export const CONFIDENCE_LEVELS = {
  HIGH: { min: 80, max: 100 },
  MEDIUM: { min: 65, max: 79 },
  LOW: { min: 45, max: 64 },
  INSUFFICIENT: { min: 0, max: 44 },
} as const;

export type ConfidenceLevel = keyof typeof CONFIDENCE_LEVELS;

/**
 * Alert thresholds for performance monitoring.
 */
export const ALERT_THRESHOLDS = {
  top_quintile_beat_rate: { target: 70, warning: 65, critical: 55 },
  bottom_quintile_beat_rate: { target: 30, warning: 35, critical: 45 }, // inverted: lower is better
  spread: { target: 3, warning: 2.5, critical: 1.5 },
  correlation: { target: 0.3, warning: 0.25, critical: 0.15 },
} as const;

/**
 * Helper function to convert a score to a letter grade.
 */
export function scoreToGrade(score: number): string {
  for (const threshold of GRADE_THRESHOLDS) {
    if (score >= threshold.min) {
      return threshold.grade;
    }
  }
  return 'F';
}

/**
 * Helper function to determine confidence level from a confidence score.
 */
export function getConfidenceLevel(confidenceScore: number): ConfidenceLevel {
  if (confidenceScore >= CONFIDENCE_LEVELS.HIGH.min) return 'HIGH';
  if (confidenceScore >= CONFIDENCE_LEVELS.MEDIUM.min) return 'MEDIUM';
  if (confidenceScore >= CONFIDENCE_LEVELS.LOW.min) return 'LOW';
  return 'INSUFFICIENT';
}

/**
 * Get all metric names required for a specific score calculation.
 */
export function getRequiredMetrics(
  geography: GeographyLevel,
  scoreType: ScoreType,
): string[] {
  return Object.keys(FORMULA_WEIGHTS[geography][scoreType]);
}

/**
 * Validate that formula weights sum to approximately 1.0 (100%).
 */
export function validateFormulaWeights(
  geography: GeographyLevel,
  scoreType: ScoreType,
): { valid: boolean; sum: number } {
  const formula = FORMULA_WEIGHTS[geography][scoreType];
  const sum = Object.values(formula).reduce((acc, m) => acc + m.weight, 0);
  // Allow for small floating point errors (within 1%)
  const valid = Math.abs(sum - 1.0) < 0.01;
  return { valid, sum };
}

/**
 * Calibration table: maps score quintiles to average historical excess return.
 * Built from v2.0 backtest data (metro level, 3Y excess vs Census Division median).
 * Used for frontend tooltips, dollar impact calculations, and interpretation.
 *
 * Score semantics (percentile rank normalization):
 *   Score 50 = median metro, predicted to earn roughly the benchmark return
 *   Score 80 = top 20%, predicted to significantly outperform
 *   Score 20 = bottom 20%, predicted to significantly underperform
 *
 * avgExcessReturn: 3-year annualized excess return vs regional benchmark (percentage points)
 * Generated from get_quintile_performance() RPC on v2.0 backtest outcomes.
 */
export interface CalibrationEntry {
  quintile: number;
  scoreRange: [number, number];
  label: string;
  avgExcessReturn: number;
}

export const SCORE_CALIBRATION: Record<ScoreType, CalibrationEntry[]> = {
  homeready: [
    { quintile: 1, scoreRange: [0, 20], label: 'Bottom 20%', avgExcessReturn: -1.74 },
    { quintile: 2, scoreRange: [20, 40], label: 'Below Average', avgExcessReturn: -0.41 },
    { quintile: 3, scoreRange: [40, 60], label: 'Average', avgExcessReturn: 0.06 },
    { quintile: 4, scoreRange: [60, 80], label: 'Above Average', avgExcessReturn: 0.32 },
    { quintile: 5, scoreRange: [80, 100], label: 'Top 20%', avgExcessReturn: 1.11 },
  ],
  investoredge: [
    { quintile: 1, scoreRange: [0, 20], label: 'Bottom 20%', avgExcessReturn: -1.76 },
    { quintile: 2, scoreRange: [20, 40], label: 'Below Average', avgExcessReturn: -0.12 },
    { quintile: 3, scoreRange: [40, 60], label: 'Average', avgExcessReturn: 0.02 },
    { quintile: 4, scoreRange: [60, 80], label: 'Above Average', avgExcessReturn: 0.55 },
    { quintile: 5, scoreRange: [80, 100], label: 'Top 20%', avgExcessReturn: 0.69 },
  ],
  markethealth: [
    { quintile: 1, scoreRange: [0, 20], label: 'Coldest 20%', avgExcessReturn: -1.50 },
    { quintile: 2, scoreRange: [20, 40], label: 'Cool', avgExcessReturn: -0.30 },
    { quintile: 3, scoreRange: [40, 60], label: 'Neutral', avgExcessReturn: 0.00 },
    { quintile: 4, scoreRange: [60, 80], label: 'Warm', avgExcessReturn: 0.40 },
    { quintile: 5, scoreRange: [80, 100], label: 'Hottest 20%', avgExcessReturn: 0.80 },
  ],
};

/**
 * Current formula version identifier.
 */
export const FORMULA_VERSION = 'v2.0';
