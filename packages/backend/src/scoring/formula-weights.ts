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
 * v3.0: Optimized via walk-forward CV with model tournament (XGBoost/LightGBM/ElasticNet).
 * Features: Redfin market activity, Census demographics, Realtor listings, calculated affordability,
 * FRED macro (VIX), Zillow inventory (metro only), economic GDP (county only).
 *
 * County/ZIP InvestorEdge = HomeReady weights (no separate IE model at these geos).
 */
export const FORMULA_WEIGHTS: Record<GeographyLevel, GeographyFormulas> = {
  // ===================
  // METRO (OOS IC: HR=0.30, IE=0.37, MH=0.37) — XGBoost all three
  // ===================
  metro: {
    homeready: {
      cen_median_age: { weight: 0.1674, direction: -1 },
      cen_population_yoy: { weight: 0.1605, direction: -1 },
      rf_median_dom: { weight: 0.1364, direction: -1 },
      rf_off_market_in_two_weeks: { weight: 0.1209, direction: -1 },
      z_inventory: { weight: 0.0958, direction: 1 },
      cen_income_yoy: { weight: 0.0869, direction: -1 },
      cen_homeownership_rate: { weight: 0.0796, direction: -1 },
      cen_rent_as_pct_of_income: { weight: 0.0631, direction: -1 },
      rf_sold_above_list: { weight: 0.0605, direction: 1 },
      rf_avg_sale_to_list: { weight: 0.0289, direction: -1 },
    },
    investoredge: {
      z_inventory: { weight: 0.1863, direction: 1 },
      rf_median_dom: { weight: 0.1847, direction: 1 },
      cen_population_yoy: { weight: 0.1332, direction: 1 },
      rf_avg_sale_to_list: { weight: 0.1104, direction: -1 },
      cen_median_age: { weight: 0.0861, direction: 1 },
      cen_income_yoy: { weight: 0.0805, direction: -1 },
      rf_sold_above_list: { weight: 0.074, direction: -1 },
      rf_off_market_in_two_weeks: { weight: 0.0586, direction: 1 },
      cen_homeownership_rate: { weight: 0.0459, direction: -1 },
      cen_rent_as_pct_of_income: { weight: 0.0403, direction: -1 },
    },
    markethealth: {
      z_inventory: { weight: 0.2572, direction: 1 },
      cen_population_yoy: { weight: 0.1883, direction: 1 },
      cen_income_yoy: { weight: 0.1747, direction: -1 },
      cen_median_age: { weight: 0.1192, direction: 1 },
      rf_off_market_in_two_weeks: { weight: 0.0617, direction: 1 },
      rf_median_dom: { weight: 0.0595, direction: 1 },
      cen_rent_as_pct_of_income: { weight: 0.0448, direction: -1 },
      rf_sold_above_list: { weight: 0.0418, direction: 1 },
      cen_homeownership_rate: { weight: 0.0379, direction: -1 },
      rf_avg_sale_to_list: { weight: 0.0149, direction: 1 },
    },
  },

  // ===================
  // COUNTY (OOS IC: HR=0.25, MH=0.28) — LightGBM both; IE duplicates HR
  // ===================
  county: {
    homeready: {
      cen_population_yoy: { weight: 0.2103, direction: -1 },
      calc_income_to_buy: { weight: 0.1312, direction: -1 },
      cen_median_age: { weight: 0.1302, direction: -1 },
      fred_vix: { weight: 0.1127, direction: 1 },
      rf_off_market_in_two_weeks: { weight: 0.1108, direction: 1 },
      rf_sold_above_list: { weight: 0.0752, direction: 1 },
      price_reduced_share: { weight: 0.0743, direction: 1 },
      econ_gdp_yoy: { weight: 0.073, direction: 1 },
      cen_homeownership_rate: { weight: 0.0484, direction: -1 },
      cen_income_yoy: { weight: 0.0337, direction: -1 },
    },
    // InvestorEdge (County): duplicates HomeReady (no separate IE model at county level)
    investoredge: {
      cen_population_yoy: { weight: 0.2103, direction: -1 },
      calc_income_to_buy: { weight: 0.1312, direction: -1 },
      cen_median_age: { weight: 0.1302, direction: -1 },
      fred_vix: { weight: 0.1127, direction: 1 },
      rf_off_market_in_two_weeks: { weight: 0.1108, direction: 1 },
      rf_sold_above_list: { weight: 0.0752, direction: 1 },
      price_reduced_share: { weight: 0.0743, direction: 1 },
      econ_gdp_yoy: { weight: 0.073, direction: 1 },
      cen_homeownership_rate: { weight: 0.0484, direction: -1 },
      cen_income_yoy: { weight: 0.0337, direction: -1 },
    },
    markethealth: {
      cen_population_yoy: { weight: 0.247, direction: -1 },
      fred_vix: { weight: 0.216, direction: 1 },
      price_reduced_share: { weight: 0.1025, direction: 1 },
      cen_income_yoy: { weight: 0.1005, direction: 1 },
      calc_income_to_buy: { weight: 0.0889, direction: -1 },
      cen_median_age: { weight: 0.0831, direction: -1 },
      econ_gdp_yoy: { weight: 0.049, direction: 1 },
      rf_off_market_in_two_weeks: { weight: 0.041, direction: 1 },
      rf_sold_above_list: { weight: 0.0391, direction: -1 },
      cen_homeownership_rate: { weight: 0.0329, direction: 1 },
    },
  },

  // ===================
  // ZIP (OOS IC: HR=0.18, MH=0.22) — XGBoost both; IE duplicates HR
  // ===================
  zip: {
    homeready: {
      calc_income_to_buy: { weight: 0.198, direction: 1 },
      rf_median_dom: { weight: 0.161, direction: 1 },
      cen_homeownership_rate: { weight: 0.1594, direction: -1 },
      rf_sold_above_list: { weight: 0.1076, direction: 1 },
      rf_off_market_in_two_weeks: { weight: 0.1056, direction: 1 },
      rf_sold_above_list_yoy: { weight: 0.0667, direction: -1 },
      rf_avg_sale_to_list: { weight: 0.0589, direction: 1 },
      rf_homes_sold_yoy: { weight: 0.053, direction: -1 },
      rf_median_dom_yoy: { weight: 0.053, direction: 1 },
      pending_listing_count_yy: { weight: 0.0368, direction: -1 },
    },
    // InvestorEdge (ZIP): duplicates HomeReady (no separate IE model at ZIP level)
    investoredge: {
      calc_income_to_buy: { weight: 0.198, direction: 1 },
      rf_median_dom: { weight: 0.161, direction: 1 },
      cen_homeownership_rate: { weight: 0.1594, direction: -1 },
      rf_sold_above_list: { weight: 0.1076, direction: 1 },
      rf_off_market_in_two_weeks: { weight: 0.1056, direction: 1 },
      rf_sold_above_list_yoy: { weight: 0.0667, direction: -1 },
      rf_avg_sale_to_list: { weight: 0.0589, direction: 1 },
      rf_homes_sold_yoy: { weight: 0.053, direction: -1 },
      rf_median_dom_yoy: { weight: 0.053, direction: 1 },
      pending_listing_count_yy: { weight: 0.0368, direction: -1 },
    },
    markethealth: {
      pending_listing_count_yy: { weight: 0.3396, direction: 1 },
      calc_income_to_buy: { weight: 0.2452, direction: -1 },
      rf_median_dom: { weight: 0.0842, direction: -1 },
      rf_sold_above_list: { weight: 0.0755, direction: -1 },
      cen_homeownership_rate: { weight: 0.0695, direction: -1 },
      rf_avg_sale_to_list: { weight: 0.0676, direction: 1 },
      rf_off_market_in_two_weeks: { weight: 0.0564, direction: 1 },
      rf_sold_above_list_yoy: { weight: 0.0306, direction: 1 },
      rf_homes_sold_yoy: { weight: 0.0165, direction: -1 },
      rf_median_dom_yoy: { weight: 0.0148, direction: -1 },
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
 * v3.0: Updated from walk-forward model tournament OOS IC (mean Spearman rank correlation).
 */
export const MODEL_CORRELATIONS: Record<
  GeographyLevel,
  Record<ScoreType, number>
> = {
  metro: {
    homeready: 0.2996, // XGBoost walk-forward OOS IC
    investoredge: 0.3724, // XGBoost walk-forward OOS IC
    markethealth: 0.3659, // XGBoost walk-forward OOS IC
  },
  county: {
    homeready: 0.2459, // LightGBM walk-forward OOS IC
    investoredge: 0.2459, // Duplicates HR (no separate IE model at county)
    markethealth: 0.2818, // LightGBM walk-forward OOS IC
  },
  zip: {
    homeready: 0.1841, // XGBoost walk-forward OOS IC
    investoredge: 0.1841, // Duplicates HR (no separate IE model at ZIP)
    markethealth: 0.2213, // XGBoost walk-forward OOS IC
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
 * Mapped to letter grades: A (excellent data), B (good), C (fair), F (insufficient).
 */
export const CONFIDENCE_LEVELS = {
  A: { min: 80, max: 100 },
  B: { min: 65, max: 79 },
  C: { min: 45, max: 64 },
  F: { min: 0, max: 44 },
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
 * Helper function to determine confidence letter grade from a confidence score.
 */
export function getConfidenceLevel(confidenceScore: number): ConfidenceLevel {
  if (confidenceScore >= CONFIDENCE_LEVELS.A.min) return 'A';
  if (confidenceScore >= CONFIDENCE_LEVELS.B.min) return 'B';
  if (confidenceScore >= CONFIDENCE_LEVELS.C.min) return 'C';
  return 'F';
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

// ============================================================================
// Component Groups
// ============================================================================

/**
 * Component groupings for score breakdowns.
 *
 * Maps each metric in FORMULA_WEIGHTS to a logical component within each
 * score type and geography level. Used by calculateComponentBreakdown()
 * to produce per-component scores.
 *
 * Design principles:
 * - Every metric in FORMULA_WEIGHTS must appear in exactly one component group
 * - Components align with the legacy component names (HomeReadyComponents, etc.)
 *   for backwards compatibility, minus 'livability' which had no real metrics
 * - When a geography has fewer metrics, some components may have only 1 metric
 */
export type ComponentGroupDefinition = Record<string, string[]>;

export const COMPONENT_GROUPS: Record<
  ScoreType,
  Record<GeographyLevel, ComponentGroupDefinition>
> = {
  // -----------------------------------------------------------------------
  // HomeReady: affordability, market_timing, stability, growth_potential
  // -----------------------------------------------------------------------
  homeready: {
    metro: {
      affordability: ['cen_rent_as_pct_of_income', 'cen_homeownership_rate'],
      market_timing: [
        'rf_off_market_in_two_weeks',
        'rf_sold_above_list',
        'rf_avg_sale_to_list',
      ],
      stability: ['rf_median_dom', 'z_inventory'],
      growth_potential: [
        'cen_population_yoy',
        'cen_income_yoy',
        'cen_median_age',
      ],
    },
    county: {
      affordability: [
        'calc_income_to_buy',
        'cen_homeownership_rate',
        'cen_income_yoy',
      ],
      market_timing: [
        'rf_off_market_in_two_weeks',
        'rf_sold_above_list',
        'price_reduced_share',
      ],
      stability: ['econ_gdp_yoy', 'cen_median_age', 'fred_vix'],
      growth_potential: ['cen_population_yoy'],
    },
    zip: {
      affordability: ['calc_income_to_buy', 'cen_homeownership_rate'],
      market_timing: [
        'rf_sold_above_list',
        'rf_off_market_in_two_weeks',
        'rf_avg_sale_to_list',
        'rf_sold_above_list_yoy',
        'pending_listing_count_yy',
      ],
      stability: ['rf_median_dom', 'rf_median_dom_yoy', 'rf_homes_sold_yoy'],
    },
  },

  // -----------------------------------------------------------------------
  // InvestorEdge: cash_flow, rent_demand, appreciation, entry_point, risk
  // County/ZIP duplicate HomeReady weights
  // -----------------------------------------------------------------------
  investoredge: {
    metro: {
      cash_flow: ['cen_rent_as_pct_of_income'],
      rent_demand: ['rf_off_market_in_two_weeks', 'rf_sold_above_list'],
      appreciation: ['cen_population_yoy', 'cen_median_age'],
      entry_point: ['cen_homeownership_rate', 'cen_income_yoy'],
      risk: ['rf_median_dom', 'rf_avg_sale_to_list', 'z_inventory'],
    },
    county: {
      rent_demand: ['rf_off_market_in_two_weeks', 'rf_sold_above_list'],
      appreciation: ['cen_population_yoy', 'econ_gdp_yoy'],
      entry_point: [
        'calc_income_to_buy',
        'cen_homeownership_rate',
        'cen_income_yoy',
      ],
      risk: ['cen_median_age', 'fred_vix', 'price_reduced_share'],
    },
    zip: {
      rent_demand: [
        'rf_sold_above_list',
        'rf_off_market_in_two_weeks',
        'rf_sold_above_list_yoy',
        'pending_listing_count_yy',
      ],
      entry_point: ['calc_income_to_buy', 'cen_homeownership_rate'],
      risk: [
        'rf_median_dom',
        'rf_avg_sale_to_list',
        'rf_median_dom_yoy',
        'rf_homes_sold_yoy',
      ],
    },
  },

  // -----------------------------------------------------------------------
  // MarketHealth: demand_strength, supply_balance
  // -----------------------------------------------------------------------
  markethealth: {
    metro: {
      demand_strength: [
        'rf_off_market_in_two_weeks',
        'rf_sold_above_list',
        'rf_avg_sale_to_list',
        'cen_population_yoy',
      ],
      supply_balance: [
        'z_inventory',
        'rf_median_dom',
        'cen_median_age',
        'cen_income_yoy',
        'cen_homeownership_rate',
        'cen_rent_as_pct_of_income',
      ],
    },
    county: {
      demand_strength: [
        'rf_off_market_in_two_weeks',
        'rf_sold_above_list',
        'cen_population_yoy',
        'cen_income_yoy',
        'econ_gdp_yoy',
      ],
      supply_balance: [
        'fred_vix',
        'price_reduced_share',
        'calc_income_to_buy',
        'cen_median_age',
        'cen_homeownership_rate',
      ],
    },
    zip: {
      demand_strength: [
        'rf_off_market_in_two_weeks',
        'rf_sold_above_list',
        'rf_avg_sale_to_list',
        'rf_sold_above_list_yoy',
        'pending_listing_count_yy',
      ],
      supply_balance: [
        'calc_income_to_buy',
        'rf_median_dom',
        'cen_homeownership_rate',
        'rf_homes_sold_yoy',
        'rf_median_dom_yoy',
      ],
    },
  },
};

/**
 * Calibration table: maps score quintiles to average historical excess return.
 * PROVISIONAL: Built from v2.0 backtest data — needs recalibration for v3.0 weights.
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
    {
      quintile: 1,
      scoreRange: [0, 20],
      label: 'Bottom 20%',
      avgExcessReturn: -1.74,
    },
    {
      quintile: 2,
      scoreRange: [20, 40],
      label: 'Below Average',
      avgExcessReturn: -0.41,
    },
    {
      quintile: 3,
      scoreRange: [40, 60],
      label: 'Average',
      avgExcessReturn: 0.06,
    },
    {
      quintile: 4,
      scoreRange: [60, 80],
      label: 'Above Average',
      avgExcessReturn: 0.32,
    },
    {
      quintile: 5,
      scoreRange: [80, 100],
      label: 'Top 20%',
      avgExcessReturn: 1.11,
    },
  ],
  investoredge: [
    {
      quintile: 1,
      scoreRange: [0, 20],
      label: 'Bottom 20%',
      avgExcessReturn: -1.76,
    },
    {
      quintile: 2,
      scoreRange: [20, 40],
      label: 'Below Average',
      avgExcessReturn: -0.12,
    },
    {
      quintile: 3,
      scoreRange: [40, 60],
      label: 'Average',
      avgExcessReturn: 0.02,
    },
    {
      quintile: 4,
      scoreRange: [60, 80],
      label: 'Above Average',
      avgExcessReturn: 0.55,
    },
    {
      quintile: 5,
      scoreRange: [80, 100],
      label: 'Top 20%',
      avgExcessReturn: 0.69,
    },
  ],
  markethealth: [
    {
      quintile: 1,
      scoreRange: [0, 20],
      label: 'Coldest 20%',
      avgExcessReturn: -1.5,
    },
    { quintile: 2, scoreRange: [20, 40], label: 'Cool', avgExcessReturn: -0.3 },
    {
      quintile: 3,
      scoreRange: [40, 60],
      label: 'Neutral',
      avgExcessReturn: 0.0,
    },
    { quintile: 4, scoreRange: [60, 80], label: 'Warm', avgExcessReturn: 0.4 },
    {
      quintile: 5,
      scoreRange: [80, 100],
      label: 'Hottest 20%',
      avgExcessReturn: 0.8,
    },
  ],
};

/**
 * Current formula version identifier.
 */
export const FORMULA_VERSION = 'v3.0';
