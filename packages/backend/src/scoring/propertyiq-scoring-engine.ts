/**
 * PropertyIQ Demand Signal Scoring Engine
 *
 * Pure math module — no database access. Implements the formula:
 *   signal = z(zhvi_yoy) + z(zhvi_mom_3m) - z(median_days_on_market)
 *            - z(price_reduced_share)
 *
 * Then: percentile rank -> re-center at zero-crossing -> score 1-99
 *
 * Python replica (must stay bit-for-bit identical):
 * scripts/analysis/monolithic-discovery/backfill_generate.py
 */

import {
  GeographyLevel,
  PROPERTYIQ_FORMULA_METRICS,
  PROPERTYIQ_METRIC_DIRECTIONS,
  PROPERTYIQ_ZERO_CROSSING,
  scoreToGrade,
  getConfidenceLevel,
} from './formula-weights';
import type { LocationMetrics, ConfidenceLevel } from './scoring.types';

// ============================================================================
// Types
// ============================================================================

export interface PropertyIqScoreResult {
  locationId: string;
  locationName: string;
  score: number; // 1-99
  grade: string; // A+ through F
  confidence: number; // 0-100
  confidenceLevel: ConfidenceLevel;
  signal: number; // raw z-score signal
  percentileRank: number; // 0-100
  medianPrice: number | null;
  inputMetrics: Record<string, number | null>;
}

// ============================================================================
// Internal helpers
// ============================================================================

/** Extract the raw value for a formula metric from a LocationMetrics record.
 *  All four metrics are set as dynamic keys by fetchPropertyIqMetrics. */
function getMetricValue(loc: LocationMetrics, metric: string): number | null {
  return (loc as Record<string, any>)[metric] ?? null;
}

/** Compute mean and standard deviation of an array of numbers. */
function meanAndStd(values: number[]): { mean: number; std: number } {
  const n = values.length;
  if (n === 0) return { mean: 0, std: 0 };
  const mean = values.reduce((sum, v) => sum + v, 0) / n;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
  return { mean, std: Math.sqrt(variance) };
}

/**
 * Compute cross-sectional z-scores for a single metric across all locations.
 * Returns a Map<locationId, zScore>. Skips metrics with std=0 or <2 valid values.
 */
function computeZScores(
  locations: LocationMetrics[],
  metric: string,
): Map<string, number> {
  const result = new Map<string, number>();
  const validValues: { locationId: string; value: number }[] = [];

  for (const loc of locations) {
    const val = getMetricValue(loc, metric);
    if (val != null && isFinite(val)) {
      validValues.push({ locationId: loc.location_id, value: val });
    }
  }

  if (validValues.length < 2) return result;

  const { mean, std } = meanAndStd(validValues.map((v) => v.value));
  if (std === 0) return result;

  for (const { locationId, value } of validValues) {
    result.set(locationId, (value - mean) / std);
  }

  return result;
}

/**
 * Assign average-rank percentile ranks to signal values (0-100 scale).
 * Ties get the average of the ranks they would span.
 *
 * For n=1, returns 50 (median by convention).
 *
 * Matches pandas `.rank(pct=True) * 100`:
 *   1-based ranking with average tie-breaking, pctRank = (avgRank / n) * 100
 */
function percentileRank(
  entries: { locationId: string; signal: number }[],
): Map<string, number> {
  const result = new Map<string, number>();
  const n = entries.length;

  if (n === 0) return result;
  if (n === 1) {
    result.set(entries[0].locationId, 50);
    return result;
  }

  // Sort ascending by signal
  const sorted = [...entries].sort((a, b) => a.signal - b.signal);

  // Assign average rank for ties (1-based, matching pandas .rank())
  let i = 0;
  while (i < n) {
    let j = i;
    // Find the extent of the tie group
    while (j < n && sorted[j].signal === sorted[i].signal) {
      j++;
    }
    // Average 1-based rank for this tie group: mean of (i+1)..(j)
    const avgRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) {
      result.set(sorted[k].locationId, (avgRank / n) * 100);
    }
    i = j;
  }

  return result;
}

/**
 * Re-center percentile rank so that the zero-crossing percentile maps to score 50.
 *
 * Two linear segments:
 *   Below zero-crossing: [0, zeroCrossing] -> [1, 50]
 *   Above zero-crossing: [zeroCrossing, 100] -> [50, 99]
 *
 * Clamped to [1, 99].
 */
function recenterScore(pctRank: number, zeroCrossing: number): number {
  let score: number;
  if (pctRank <= zeroCrossing) {
    // Linear map [0, zeroCrossing] -> [1, 50]
    score = 1 + (pctRank / zeroCrossing) * 49;
  } else {
    // Linear map [zeroCrossing, 100] -> [50, 99]
    score = 50 + ((pctRank - zeroCrossing) / (100 - zeroCrossing)) * 49;
  }
  return Math.max(1, Math.min(99, Math.round(score)));
}

/**
 * Calculate confidence from formula-input completeness.
 * 4/4 metrics present = 100%, 3/4 = 75%, 2/4 = 50%, fewer = unscored anyway.
 */
function calculatePropertyIqConfidence(loc: LocationMetrics): number {
  let available = 0;
  for (const metric of PROPERTYIQ_FORMULA_METRICS) {
    const val = getMetricValue(loc, metric);
    if (val != null && isFinite(val)) {
      available++;
    }
  }
  return Math.round((available / PROPERTYIQ_FORMULA_METRICS.length) * 100);
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Calculate PropertyIQ demand signal scores for a set of locations.
 *
 * Algorithm:
 * 1. Z-score each formula metric cross-sectionally
 * 2. Compute signal = sum of z(metric) * direction over PROPERTYIQ_FORMULA_METRICS
 * 3. Percentile rank (average rank for ties, 0-100)
 * 4. Re-center at zero-crossing so signal = 0 maps to score 50
 * 5. Grade using standard scoreToGrade()
 * 6. Confidence based on metric completeness
 */
export function calculatePropertyIqScores(
  locations: LocationMetrics[],
  geography: GeographyLevel,
): PropertyIqScoreResult[] {
  if (locations.length === 0) return [];

  // Step 1: Compute z-scores for each metric
  const zScoreMaps = new Map<string, Map<string, number>>();
  for (const metric of PROPERTYIQ_FORMULA_METRICS) {
    zScoreMaps.set(metric, computeZScores(locations, metric));
  }

  // Step 2: Compute signal. Require at least 2 of the 4 metrics — Realtor
  // flow metrics start 2016-07 and coverage is a Zillow ∪ Realtor union, so
  // momentum-only or flow-only regions still score (at reduced confidence).
  const MIN_METRICS_FOR_SIGNAL = 2;
  const signalEntries: { locationId: string; signal: number }[] = [];
  const signalMap = new Map<string, number>();

  for (const loc of locations) {
    let signal = 0;
    let metricCount = 0;

    for (const metric of PROPERTYIQ_FORMULA_METRICS) {
      const zMap = zScoreMaps.get(metric)!;
      const z = zMap.get(loc.location_id);
      if (z == null) continue;
      const direction = PROPERTYIQ_METRIC_DIRECTIONS[metric];
      signal += z * direction;
      metricCount++;
    }

    if (metricCount >= MIN_METRICS_FOR_SIGNAL) {
      signalEntries.push({ locationId: loc.location_id, signal });
      signalMap.set(loc.location_id, signal);
    }
  }

  // Step 3: Percentile rank
  const pctRankMap = percentileRank(signalEntries);

  // Step 4 & 5 & 6: Re-center, grade, confidence
  const zeroCrossing = PROPERTYIQ_ZERO_CROSSING[geography];
  const results: PropertyIqScoreResult[] = [];

  for (const loc of locations) {
    const confidence = calculatePropertyIqConfidence(loc);
    const confidenceLevel = getConfidenceLevel(confidence);
    const signal = signalMap.get(loc.location_id);
    const pctRank = pctRankMap.get(loc.location_id);

    // Locations without enough metrics (min 2 of 4) get no score — skip.
    if (signal == null || pctRank == null) {
      continue;
    }

    const score = recenterScore(pctRank, zeroCrossing);
    const grade = scoreToGrade(score);

    results.push({
      locationId: loc.location_id,
      locationName: loc.location_name,
      score,
      grade,
      confidence,
      confidenceLevel,
      signal,
      percentileRank: Math.round(pctRank * 100) / 100,
      medianPrice: loc.median_price ?? null,
      inputMetrics: Object.fromEntries(
        PROPERTYIQ_FORMULA_METRICS.map((m) => [m, getMetricValue(loc, m)]),
      ),
    });
  }

  return results;
}
