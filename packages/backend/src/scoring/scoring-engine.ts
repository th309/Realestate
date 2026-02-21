/**
 * Scoring Engine - Pure Calculation Functions
 *
 * Contains all the mathematical/statistical functions for computing PropertyIQ scores:
 * - Z-score calculation across locations
 * - Formula application (weighted z-scores)
 * - Score normalization (percentile rank)
 * - Component breakdown (per-component scores)
 * - Confidence calculation (4-factor model)
 *
 * These functions are pure: they take data in and produce results without database access.
 * Extracted from ScoringService for modularity.
 */

import {
  FORMULA_WEIGHTS,
  COMPONENT_GROUPS,
  getConfidenceLevel,
  ScoreType,
  GeographyLevel,
  FormulaDefinition,
  ConfidenceLevel,
} from './formula-weights';
import {
  LocationMetrics,
  ScoreComponentBreakdown,
  ComponentStatus,
} from './scoring.types';

export interface ZScoreMap {
  [locationId: string]: { [metricName: string]: number };
}

export interface RawScoreResult {
  locationId: string;
  rawScore: number;
}

/**
 * Get all metric names used across all formulas for a geography.
 */
export function getAllMetricNames(geography: GeographyLevel): string[] {
  const metrics = new Set<string>();

  for (const scoreType of ['homeready', 'investoredge', 'markethealth'] as ScoreType[]) {
    const formula = FORMULA_WEIGHTS[geography][scoreType];
    for (const metricName of Object.keys(formula)) {
      metrics.add(metricName);
    }
  }

  return Array.from(metrics);
}

/**
 * Calculate z-scores for all metrics across all locations.
 */
export function calculateZScores(
  locations: LocationMetrics[],
  metricNames: string[],
): ZScoreMap {
  const zScores: ZScoreMap = {};

  for (const location of locations) {
    zScores[location.location_id] = {};
  }

  for (const metricName of metricNames) {
    const values: number[] = [];
    for (const location of locations) {
      const value = (location as any)[metricName];
      if (value !== null && value !== undefined && !isNaN(value)) {
        values.push(value);
      }
    }

    if (values.length < 2) continue;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const std = Math.sqrt(variance);

    if (std === 0) continue;

    for (const location of locations) {
      const value = (location as any)[metricName];
      if (value !== null && value !== undefined && !isNaN(value)) {
        zScores[location.location_id][metricName] = (value - mean) / std;
      }
    }
  }

  return zScores;
}

/**
 * Apply formula weights to z-scores to produce raw scores.
 */
export function applyFormula(
  locations: LocationMetrics[],
  zScores: ZScoreMap,
  formula: FormulaDefinition,
): RawScoreResult[] {
  const results: RawScoreResult[] = [];

  for (const location of locations) {
    const locationZScores = zScores[location.location_id] || {};
    let rawScore = 0;
    let totalWeight = 0;

    for (const [metricName, metricDef] of Object.entries(formula)) {
      const zScore = locationZScores[metricName];
      if (zScore !== undefined) {
        rawScore += metricDef.direction * metricDef.weight * zScore;
        totalWeight += metricDef.weight;
      }
    }

    if (totalWeight > 0 && totalWeight < 1) {
      rawScore = rawScore / totalWeight;
    }

    results.push({ locationId: location.location_id, rawScore });
  }

  return results;
}

/**
 * Normalize raw scores to 0-100 using percentile rank.
 *
 * Score semantics:
 *   50 = median (predicted to earn roughly the benchmark return)
 *   80 = top 20% (predicted to significantly outperform)
 *   20 = bottom 20% (predicted to significantly underperform)
 */
export function normalizeScores(rawScores: RawScoreResult[]): number[] {
  if (rawScores.length === 0) return [];
  if (rawScores.length === 1) return [50];

  const indexed = rawScores.map((r, i) => ({ raw: r.rawScore, idx: i }));
  indexed.sort((a, b) => a.raw - b.raw);

  const result = new Array<number>(rawScores.length);
  const n = rawScores.length;

  let i = 0;
  while (i < n) {
    let j = i;
    while (j < n && indexed[j].raw === indexed[i].raw) {
      j++;
    }
    const avgPercentile = ((i + j - 1) / 2 / (n - 1)) * 100;
    const rounded = Math.round(avgPercentile * 10) / 10;
    for (let k = i; k < j; k++) {
      result[indexed[k].idx] = rounded;
    }
    i = j;
  }

  return result;
}

/**
 * Convert a z-score to a 0-100 percentile using the standard normal CDF.
 * Uses a rational approximation (Abramowitz & Stegun) for speed.
 */
export function zScoreToPercentile(z: number): number {
  const clamped = Math.max(-4, Math.min(4, z));

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = clamped < 0 ? -1 : 1;
  const x = Math.abs(clamped) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  const cdf = 0.5 * (1.0 + sign * y);
  const score = Math.round(cdf * 1000) / 10;

  return Math.max(0, Math.min(100, score));
}

/**
 * Map a component score (0-100) to a human-readable status label.
 */
export function scoreToComponentStatus(score: number): ComponentStatus {
  if (score >= 80) return 'excellent';
  if (score >= 65) return 'strong';
  if (score >= 50) return 'moderate';
  if (score >= 35) return 'watch';
  return 'concern';
}

/**
 * Calculate per-component score breakdowns for a single location.
 */
export function calculateComponentBreakdown(
  scoreType: ScoreType,
  geography: GeographyLevel,
  locationZScores: Record<string, number>,
  rawValues: Record<string, number | null>,
): ScoreComponentBreakdown[] {
  const componentGroups = COMPONENT_GROUPS[scoreType]?.[geography];
  if (!componentGroups) return [];

  const formula = FORMULA_WEIGHTS[geography][scoreType];
  const breakdowns: ScoreComponentBreakdown[] = [];

  for (const [componentName, metricNames] of Object.entries(componentGroups)) {
    if (!metricNames || metricNames.length === 0) continue;

    const contributingMetrics: ScoreComponentBreakdown['contributing_metrics'] = [];
    let weightedZScoreSum = 0;
    let totalWeight = 0;

    for (const metricName of metricNames) {
      const metricDef = formula[metricName];
      if (!metricDef) continue;

      const zScore = locationZScores[metricName];
      const rawValue = rawValues[metricName] ?? null;

      contributingMetrics.push({
        metric: metricName,
        z_score: zScore ?? 0,
        direction: metricDef.direction === 1 ? 'positive' : 'negative',
        raw_value: rawValue,
      });

      if (zScore !== undefined) {
        weightedZScoreSum += metricDef.direction * metricDef.weight * zScore;
        totalWeight += metricDef.weight;
      }
    }

    const normalizedZScore = totalWeight > 0
      ? weightedZScoreSum / totalWeight
      : 0;

    const componentScore = zScoreToPercentile(normalizedZScore);

    const componentWeight = metricNames.reduce((sum, m) => {
      return sum + (formula[m]?.weight ?? 0);
    }, 0);

    const status = scoreToComponentStatus(componentScore);

    breakdowns.push({
      component: componentName,
      score: componentScore,
      weight: Math.round(componentWeight * 1000) / 1000,
      status,
      contributing_metrics: contributingMetrics,
    });
  }

  return breakdowns;
}

/**
 * Calculate data-quality confidence score.
 *
 * Measures how confident we are in a location's score based purely on
 * data quality — NOT correlated with whether the score is high or low.
 *
 * Three factors (all location-specific, no fixed constants):
 *   1. Weighted Completeness (55%) — sum of weights for available metrics / total weight.
 *      Captures "how much of the scoring signal do we actually have data for?"
 *   2. Direct Data Ratio (30%) — fraction of available data that is direct (not inherited).
 *      Captures "how much do we trust what we have?"
 *   3. Critical Metric Coverage (15%) — are the top-3 highest-weighted metrics present?
 *      Captures "do we have the metrics that matter most in the formula?"
 */
export function calculateConfidence(
  location: LocationMetrics,
  geography: GeographyLevel,
  scoreType: ScoreType,
): { confidence: number; level: ConfidenceLevel } {
  const formula = FORMULA_WEIGHTS[geography][scoreType];
  const metricEntries = Object.entries(formula);

  // Identify which metrics have real data
  const availableMetricNames = metricEntries
    .filter(([m]) => (location as any)[m] !== null && (location as any)[m] !== undefined)
    .map(([m]) => m);

  const inheritedSet = new Set(location._inherited ?? []);

  // Factor 1: Weighted Completeness (55%)
  // Sum of formula weights for metrics that have data / total formula weight
  const totalWeight = metricEntries.reduce((sum, [, def]) => sum + def.weight, 0);
  const availableWeight = metricEntries
    .filter(([m]) => availableMetricNames.includes(m))
    .reduce((sum, [, def]) => sum + def.weight, 0);
  const weightedCompleteness = totalWeight > 0 ? (availableWeight / totalWeight) * 100 : 0;

  // Factor 2: Direct Data Ratio (30%)
  // Of the available metrics, what fraction is direct (not inherited)?
  const directCount = availableMetricNames.filter(m => !inheritedSet.has(m)).length;
  const directDataRatio = availableMetricNames.length > 0
    ? (directCount / availableMetricNames.length) * 100
    : 0;

  // Factor 3: Critical Metric Coverage (15%)
  // Are the top-3 highest-weighted metrics present? 33.3 pts each.
  const sortedByWeight = [...metricEntries].sort((a, b) => b[1].weight - a[1].weight);
  const topThreeMetrics = sortedByWeight.slice(0, 3).map(([m]) => m);
  const topThreePresent = topThreeMetrics.filter(m => availableMetricNames.includes(m)).length;
  const criticalMetricCoverage = (topThreePresent / 3) * 100;

  // Weighted average
  const confidence =
    weightedCompleteness * 0.55 +
    directDataRatio * 0.30 +
    criticalMetricCoverage * 0.15;

  const level = getConfidenceLevel(confidence);

  return {
    confidence: Math.round(confidence * 10) / 10,
    level,
  };
}
