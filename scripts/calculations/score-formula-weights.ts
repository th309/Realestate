/**
 * PropertyIQ Score Formula Weights and Grade Thresholds.
 *
 * Defines the z-score weighted formulas for each score type (homeready,
 * investoredge, markethealth) at each geography level (metro, county, zip).
 *
 * Also defines model correlations, sample size scores, and grade thresholds.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ScoreType = 'homeready' | 'investoredge' | 'markethealth';
export type GeoLevel = 'metro' | 'county' | 'zip';

export interface MetricWeight {
  weight: number;
  direction: 1 | -1;
}

// ---------------------------------------------------------------------------
// Formula Weights (from SCORING_SYSTEM_SPEC.md)
// ---------------------------------------------------------------------------

export const FORMULA_WEIGHTS: Record<GeoLevel, Record<ScoreType, Record<string, MetricWeight>>> = {
  metro: {
    homeready: {
      hotness_score: { weight: 0.706, direction: 1 },
      pending_ratio: { weight: 0.152, direction: 1 },
      unemployment_rate_yoy: { weight: 0.057, direction: -1 },
      population_yoy: { weight: 0.054, direction: -1 },
      demand_score: { weight: 0.031, direction: 1 },
    },
    investoredge: {
      hotness_score: { weight: 0.317, direction: 1 },
      median_gross_rent: { weight: 0.315, direction: -1 },
      affordability_ratio: { weight: 0.188, direction: -1 },
      pending_ratio: { weight: 0.080, direction: 1 },
      homeownership_rate: { weight: 0.047, direction: 1 },
      population_yoy: { weight: 0.035, direction: -1 },
      unemployment_rate_yoy: { weight: 0.018, direction: -1 },
    },
    markethealth: {
      hotness_score: { weight: 0.416, direction: 1 },
      demand_score: { weight: 0.345, direction: 1 },
      pending_ratio: { weight: 0.239, direction: 1 },
    },
  },
  county: {
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
    markethealth: {
      hotness_score: { weight: 0.533, direction: 1 },
      demand_score: { weight: 0.254, direction: 1 },
      pending_ratio: { weight: 0.213, direction: 1 },
    },
  },
  zip: {
    homeready: {
      hotness_score: { weight: 0.534, direction: 1 },
      demand_score: { weight: 0.184, direction: 1 },
      pending_ratio: { weight: 0.165, direction: 1 },
      active_listing_count_yy: { weight: 0.101, direction: 1 },
      price_reduced_count_yy: { weight: 0.016, direction: 1 },
    },
    investoredge: {
      hotness_score: { weight: 0.534, direction: 1 },
      demand_score: { weight: 0.184, direction: 1 },
      pending_ratio: { weight: 0.165, direction: 1 },
      active_listing_count_yy: { weight: 0.101, direction: 1 },
      price_reduced_count_yy: { weight: 0.016, direction: 1 },
    },
    markethealth: {
      hotness_score: { weight: 0.699, direction: 1 },
      demand_score: { weight: 0.301, direction: 1 },
    },
  },
};

// ---------------------------------------------------------------------------
// Model quality & confidence parameters
// ---------------------------------------------------------------------------

export const MODEL_CORRELATIONS: Record<GeoLevel, Record<ScoreType, number>> = {
  metro: { homeready: 0.69, investoredge: 0.79, markethealth: 0.56 },
  county: { homeready: 0.16, investoredge: 0.09, markethealth: 0.29 },
  zip: { homeready: 0.37, investoredge: 0.37, markethealth: 0.26 },
};

export const SAMPLE_SIZE_SCORES: Record<GeoLevel, number> = {
  metro: 60,
  county: 80,
  zip: 100,
};

// ---------------------------------------------------------------------------
// Grade & confidence thresholds
// ---------------------------------------------------------------------------

export const GRADE_THRESHOLDS = [
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

export function scoreToGrade(score: number): string {
  for (const threshold of GRADE_THRESHOLDS) {
    if (score >= threshold.min) return threshold.grade;
  }
  return 'F';
}

export function getConfidenceLevel(confidence: number): string {
  if (confidence >= 80) return 'HIGH';
  if (confidence >= 65) return 'MEDIUM';
  if (confidence >= 45) return 'LOW';
  return 'INSUFFICIENT';
}
