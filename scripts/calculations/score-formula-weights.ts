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

export type ScoreType = "homeready" | "investoredge" | "markethealth";
export type GeoLevel = "metro" | "county" | "zip";

export interface MetricWeight {
  weight: number;
  direction: 1 | -1;
}

// ---------------------------------------------------------------------------
// Formula Weights (from SCORING_SYSTEM_SPEC.md)
// ---------------------------------------------------------------------------

export const FORMULA_WEIGHTS: Record<
  GeoLevel,
  Record<ScoreType, Record<string, MetricWeight>>
> = {
  metro: {
    homeready: {
      median_days_on_market: { weight: 0.3096, direction: -1 },
      affordability_ratio: { weight: 0.1671, direction: 1 },
      pending_ratio: { weight: 0.1484, direction: 1 },
      supply_score: { weight: 0.1477, direction: -1 },
      population_yoy: { weight: 0.0889, direction: 1 },
      demand_score: { weight: 0.0845, direction: 1 },
      price_reduced_share: { weight: 0.0374, direction: -1 },
      unemployment_rate_yoy: { weight: 0.0164, direction: -1 },
    },
    investoredge: {
      median_days_on_market: { weight: 0.2887, direction: -1 },
      affordability_ratio: { weight: 0.177, direction: 1 },
      pending_ratio: { weight: 0.1564, direction: 1 },
      supply_score: { weight: 0.1287, direction: -1 },
      population_yoy: { weight: 0.0837, direction: 1 },
      demand_score: { weight: 0.0657, direction: 1 },
      median_gross_rent: { weight: 0.0575, direction: -1 },
      homeownership_rate: { weight: 0.0423, direction: 1 },
    },
    markethealth: {
      hotness_score: { weight: 0.416, direction: 1 },
      demand_score: { weight: 0.345, direction: 1 },
      pending_ratio: { weight: 0.239, direction: 1 },
    },
  },
  county: {
    homeready: {
      median_days_on_market: { weight: 0.2595, direction: -1 },
      pending_ratio: { weight: 0.2194, direction: 1 },
      population_yoy: { weight: 0.1945, direction: 1 },
      affordability_ratio: { weight: 0.0903, direction: -1 },
      demand_score: { weight: 0.0874, direction: 1 },
      unemployment_rate_yoy: { weight: 0.0759, direction: 1 },
      supply_score: { weight: 0.0393, direction: -1 },
      price_reduced_share: { weight: 0.0337, direction: 1 },
    },
    investoredge: {
      median_days_on_market: { weight: 0.2497, direction: -1 },
      pending_ratio: { weight: 0.2115, direction: 1 },
      population_yoy: { weight: 0.1904, direction: 1 },
      affordability_ratio: { weight: 0.0884, direction: -1 },
      median_gross_rent: { weight: 0.0719, direction: 1 },
      demand_score: { weight: 0.0641, direction: 1 },
      homeownership_rate: { weight: 0.0623, direction: 1 },
      unemployment_rate_yoy: { weight: 0.0617, direction: 1 },
    },
    markethealth: {
      hotness_score: { weight: 0.533, direction: 1 },
      demand_score: { weight: 0.254, direction: 1 },
      pending_ratio: { weight: 0.213, direction: 1 },
    },
  },
  zip: {
    homeready: {
      demand_score: { weight: 0.3024, direction: 1 },
      pending_ratio: { weight: 0.2918, direction: 1 },
      median_days_on_market: { weight: 0.2049, direction: -1 },
      hotness_score: { weight: 0.1393, direction: 1 },
      affordability_ratio: { weight: 0.0312, direction: 1 },
      price_reduced_share: { weight: 0.0304, direction: 1 },
    },
    investoredge: {
      pending_ratio: { weight: 0.2384, direction: 1 },
      homeownership_rate: { weight: 0.2267, direction: 1 },
      median_days_on_market: { weight: 0.1943, direction: -1 },
      demand_score: { weight: 0.1912, direction: 1 },
      hotness_score: { weight: 0.1494, direction: 1 },
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
  { min: 93, grade: "A+" },
  { min: 87, grade: "A" },
  { min: 83, grade: "A-" },
  { min: 80, grade: "B+" },
  { min: 73, grade: "B" },
  { min: 70, grade: "B-" },
  { min: 67, grade: "C+" },
  { min: 60, grade: "C" },
  { min: 55, grade: "C-" },
  { min: 50, grade: "D+" },
  { min: 43, grade: "D" },
  { min: 40, grade: "D-" },
  { min: 0, grade: "F" },
];

export function scoreToGrade(score: number): string {
  for (const threshold of GRADE_THRESHOLDS) {
    if (score >= threshold.min) return threshold.grade;
  }
  return "F";
}

export function getConfidenceLevel(confidence: number): string {
  if (confidence >= 80) return "A";
  if (confidence >= 65) return "B";
  if (confidence >= 45) return "C";
  return "F";
}
