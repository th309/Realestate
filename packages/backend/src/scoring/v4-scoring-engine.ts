/**
 * v4 Demand Signal Scoring Engine
 *
 * Pure math module — no database access. Implements the v4 formula:
 *   signal = z(sold_above_list) - z(median_dom) - z(months_of_supply)
 *
 * Then: percentile rank -> re-center at zero-crossing -> score 1-99
 *
 * Reference implementation: scripts/analysis/recentered_score.py
 */

import {
  GeographyLevel,
  V4_FORMULA_METRICS,
  V4_METRIC_DIRECTIONS,
  V4_ZERO_CROSSING,
  V4_FORMULA_VERSION,
  scoreToGrade,
  getConfidenceLevel,
} from './formula-weights';
import type { LocationMetrics, ConfidenceLevel } from './scoring.types';

// ============================================================================
// Types
// ============================================================================

export interface V4ScoreResult {
  locationId: string;
  locationName: string;
  score: number; // 1-99
  grade: string; // A+ through F
  confidence: number; // 0-100
  confidenceLevel: ConfidenceLevel;
  signal: number; // raw z-score signal
  percentileRank: number; // 0-100
  medianPrice: number | null;
  inputMetrics: {
    sold_above_list: number | null;
    median_dom: number | null;
    months_of_supply: number | null;
  };
}

// ============================================================================
// Internal helpers
// ============================================================================

/** Extract the raw value for a v4 metric from a LocationMetrics record. */
function getMetricValue(loc: LocationMetrics, metric: string): number | null {
  switch (metric) {
    case 'sold_above_list':
      return loc.rf_sold_above_list ?? null;
    case 'median_dom':
      return loc.rf_median_dom ?? null;
    case 'months_of_supply':
      // months_of_supply is not on the standard LocationMetrics interface
      // (it's a Redfin column fetched by fetchV4Metrics). We access it via
      // a dynamic key set by the fetcher.
      return (loc as Record<string, any>).months_of_supply ?? null;
    default:
      return null;
  }
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
 * Calculate v4 confidence based on Redfin data completeness.
 * 3/3 metrics present = 100%, 2/3 = 67%, 1/3 = 33%, 0/3 = 0%.
 */
function calculateV4Confidence(loc: LocationMetrics): number {
  let available = 0;
  for (const metric of V4_FORMULA_METRICS) {
    const val = getMetricValue(loc, metric);
    if (val != null && isFinite(val)) {
      available++;
    }
  }
  return Math.round((available / V4_FORMULA_METRICS.length) * 100);
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Calculate v4 PropertyIQ demand signal scores for a set of locations.
 *
 * Algorithm (matches recentered_score.py):
 * 1. Z-score each of the 3 metrics cross-sectionally
 * 2. Compute signal = z(sold_above_list) * 1 + z(median_dom) * (-1) + z(months_of_supply) * (-1)
 * 3. Percentile rank (average rank for ties, 0-100)
 * 4. Re-center at zero-crossing so score 50 = state average performance
 * 5. Grade using standard scoreToGrade()
 * 6. Confidence based on metric completeness
 */
export function calculateV4Scores(
  locations: LocationMetrics[],
  geography: GeographyLevel,
): V4ScoreResult[] {
  if (locations.length === 0) return [];

  // Step 1: Compute z-scores for each metric
  const zScoreMaps = new Map<string, Map<string, number>>();
  for (const metric of V4_FORMULA_METRICS) {
    zScoreMaps.set(metric, computeZScores(locations, metric));
  }

  // Step 2: Compute signal. Require at least 2 of 3 metrics (months_of_supply
  // is universally NULL at ZIP level, so we degrade gracefully to 2 metrics).
  const MIN_METRICS_FOR_SIGNAL = 2;
  const signalEntries: { locationId: string; signal: number }[] = [];
  const signalMap = new Map<string, number>();

  for (const loc of locations) {
    let signal = 0;
    let metricCount = 0;

    for (const metric of V4_FORMULA_METRICS) {
      const zMap = zScoreMaps.get(metric)!;
      const z = zMap.get(loc.location_id);
      if (z == null) continue;
      const direction = V4_METRIC_DIRECTIONS[metric];
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
  const zeroCrossing = V4_ZERO_CROSSING[geography];
  const results: V4ScoreResult[] = [];

  for (const loc of locations) {
    const confidence = calculateV4Confidence(loc);
    const confidenceLevel = getConfidenceLevel(confidence);
    const signal = signalMap.get(loc.location_id);
    const pctRank = pctRankMap.get(loc.location_id);

    // Locations without enough metrics (min 2 of 3) get no score — skip.
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
      inputMetrics: {
        sold_above_list: getMetricValue(loc, 'sold_above_list'),
        median_dom: getMetricValue(loc, 'median_dom'),
        months_of_supply: getMetricValue(loc, 'months_of_supply'),
      },
    });
  }

  return results;
}

/** Current formula version for v4 scores. */
export const FORMULA_VERSION = V4_FORMULA_VERSION;
