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
 * These formulas were derived from machine learning analysis.
 */
export const FORMULA_WEIGHTS: Record<GeographyLevel, GeographyFormulas> = {
  // ===================
  // METRO LEVEL FORMULAS
  // ===================
  metro: {
    // HomeReady (Metro): Predicts 3-year price appreciation for homebuyers
    homeready: {
      hotness_score: { weight: 0.706, direction: 1 },
      pending_ratio: { weight: 0.152, direction: 1 },
      unemployment_rate_yoy: { weight: 0.057, direction: -1 },
      population_yoy: { weight: 0.054, direction: -1 },
      demand_score: { weight: 0.031, direction: 1 },
    },
    // InvestorEdge (Metro): Predicts total return (appreciation + rental yield)
    investoredge: {
      hotness_score: { weight: 0.317, direction: 1 },
      median_gross_rent: { weight: 0.315, direction: -1 },
      affordability_ratio: { weight: 0.188, direction: -1 },
      pending_ratio: { weight: 0.080, direction: 1 },
      homeownership_rate: { weight: 0.047, direction: 1 },
      population_yoy: { weight: 0.035, direction: -1 },
      unemployment_rate_yoy: { weight: 0.018, direction: -1 },
    },
    // MarketHealth (Metro): Current market conditions (how hot is the market)
    markethealth: {
      hotness_score: { weight: 0.416, direction: 1 },
      demand_score: { weight: 0.345, direction: 1 },
      pending_ratio: { weight: 0.239, direction: 1 },
    },
  },

  // ===================
  // COUNTY LEVEL FORMULAS
  // ===================
  county: {
    // HomeReady (County)
    homeready: {
      hotness_score: { weight: 0.403, direction: 1 },
      affordability_ratio: { weight: 0.132, direction: 1 },
      price_reduced_share: { weight: 0.119, direction: -1 },
      population_yoy: { weight: 0.102, direction: -1 },
      rent_price_ratio: { weight: 0.091, direction: 1 },
      pending_ratio: { weight: 0.072, direction: 1 },
      unemployment_rate_yoy: { weight: 0.049, direction: 1 },
      demand_score: { weight: 0.033, direction: 1 },
    },
    // InvestorEdge (County)
    investoredge: {
      rent_price_ratio: { weight: 0.402, direction: 1 },
      hotness_score: { weight: 0.244, direction: 1 },
      affordability_ratio: { weight: 0.094, direction: 1 },
      price_reduced_share: { weight: 0.082, direction: -1 },
      population_yoy: { weight: 0.059, direction: -1 },
      pending_ratio: { weight: 0.054, direction: 1 },
      demand_score: { weight: 0.034, direction: 1 },
      unemployment_rate_yoy: { weight: 0.030, direction: 1 },
    },
    // MarketHealth (County)
    markethealth: {
      hotness_score: { weight: 0.533, direction: 1 },
      demand_score: { weight: 0.254, direction: 1 },
      pending_ratio: { weight: 0.213, direction: 1 },
    },
  },

  // ===================
  // ZIP LEVEL FORMULAS
  // ===================
  zip: {
    // HomeReady (ZIP)
    homeready: {
      hotness_score: { weight: 0.534, direction: 1 },
      demand_score: { weight: 0.184, direction: 1 },
      pending_ratio: { weight: 0.165, direction: 1 },
      active_listing_count_yy: { weight: 0.101, direction: 1 },
      price_reduced_count_yy: { weight: 0.016, direction: 1 },
    },
    // InvestorEdge (ZIP): Same as HomeReady for ZIP level
    investoredge: {
      hotness_score: { weight: 0.534, direction: 1 },
      demand_score: { weight: 0.184, direction: 1 },
      pending_ratio: { weight: 0.165, direction: 1 },
      active_listing_count_yy: { weight: 0.101, direction: 1 },
      price_reduced_count_yy: { weight: 0.016, direction: 1 },
    },
    // MarketHealth (ZIP)
    markethealth: {
      hotness_score: { weight: 0.699, direction: 1 },
      demand_score: { weight: 0.301, direction: 1 },
    },
  },
};

/**
 * Grade thresholds for converting scores (0-100) to letter grades.
 * Ordered from highest to lowest for efficient lookup.
 */
export const GRADE_THRESHOLDS: Array<{ min: number; grade: string }> = [
  { min: 93, grade: 'A+' },
  { min: 87, grade: 'A' },
  { min: 83, grade: 'A-' },
  { min: 80, grade: 'B+' },
  { min: 73, grade: 'B' },
  { min: 70, grade: 'B-' },
  { min: 67, grade: 'C+' },
  { min: 60, grade: 'C' },
  { min: 55, grade: 'C-' },
  { min: 50, grade: 'D+' },
  { min: 43, grade: 'D' },
  { min: 40, grade: 'D-' },
  { min: 0, grade: 'F' },
];

/**
 * Model correlation values from validation.
 * Used in confidence calculation (Model Strength factor = correlation × 125, capped at 100).
 */
export const MODEL_CORRELATIONS: Record<
  GeographyLevel,
  Record<ScoreType, number>
> = {
  metro: {
    homeready: 0.69,
    investoredge: 0.79,
    markethealth: 0.56,
  },
  county: {
    homeready: 0.16,
    investoredge: 0.09,
    markethealth: 0.29,
  },
  zip: {
    homeready: 0.37,
    investoredge: 0.37,
    markethealth: 0.26,
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
 * Current formula version identifier.
 */
export const FORMULA_VERSION = 'v1.0';
