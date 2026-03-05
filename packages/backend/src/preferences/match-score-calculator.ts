/**
 * Match Score Calculator
 *
 * Pure computation functions for the market match scoring pipeline.
 * Handles percentile ranking, weighted score computation, budget
 * filtering, and data extraction from bulk-fetched metric maps.
 *
 * Stateless — no database access. Used by MarketMatchService.
 */

import { ResolvedMetric } from '../metric-resolution/metric-resolution.types';
import { UserPreferences } from './preferences.types';
import { MatchMetricWeight } from './match-weights';

export interface MatchScoreResult {
  regionId: string;
  regionName: string | null;
  matchScore: number;
  metricsUsed: number;
  metricsTotal: number;
  budgetMatch: boolean;
  breakdown: Record<
    string,
    { value: number | null; percentile: number; weight: number }
  >;
}

/**
 * Build a percentile lookup: for each metric, a sorted array of all
 * region values used to compute any single region's percentile rank.
 */
export function buildPercentileLookup(
  allRegionValues: Map<string, Map<string, number>>,
  metricIds: string[],
): Map<string, number[]> {
  const lookup = new Map<string, number[]>();

  for (const metricId of metricIds) {
    const regionMap = allRegionValues.get(metricId);
    if (!regionMap || regionMap.size === 0) {
      lookup.set(metricId, []);
      continue;
    }
    const sorted = [...regionMap.values()].sort((a, b) => a - b);
    lookup.set(metricId, sorted);
  }

  return lookup;
}

/**
 * Extract the set of all unique region IDs present in any metric's data.
 */
export function extractRegionIds(
  allRegionValues: Map<string, Map<string, number>>,
): string[] {
  const ids = new Set<string>();
  for (const regionMap of allRegionValues.values()) {
    for (const regionId of regionMap.keys()) {
      ids.add(regionId);
    }
  }
  return [...ids];
}

/**
 * Build a ResolvedMetric-shaped record for a region from pre-fetched
 * bulk data. Used when scoring all regions without per-region DB calls.
 */
export function extractRegionData(
  allRegionValues: Map<string, Map<string, number>>,
  regionId: string,
  metricIds: string[],
): Record<string, ResolvedMetric> {
  const result: Record<string, ResolvedMetric> = {};

  for (const metricId of metricIds) {
    const regionMap = allRegionValues.get(metricId);
    const value = regionMap?.get(regionId) ?? null;

    result[metricId] = {
      value,
      date: null,
      source: value !== null ? 'bulk' : 'none',
      sourceGeoId: regionId,
      sourceGeoLevel: null,
      isInherited: false,
      isFallback: false,
    };
  }

  return result;
}

/**
 * Compute the match score for a single region given its resolved metrics,
 * the user's merged weight map, and a percentile distribution lookup.
 *
 * Returns null if zero metrics could be resolved for this region.
 */
export function computeMatchScore(
  regionId: string,
  resolved: Record<string, ResolvedMetric>,
  weightMap: Record<string, MatchMetricWeight>,
  percentileLookup: Map<string, number[]>,
  prefs: UserPreferences,
): MatchScoreResult | null {
  let weightedSum = 0;
  let usedWeight = 0;
  let metricsUsed = 0;
  const metricsTotal = Object.keys(weightMap).length;
  const breakdown: MatchScoreResult['breakdown'] = {};

  for (const [metricId, config] of Object.entries(weightMap)) {
    const metric = resolved[metricId];
    const value = metric?.value ?? null;
    const sortedValues = percentileLookup.get(metricId) ?? [];

    if (value === null || sortedValues.length === 0) {
      breakdown[metricId] = {
        value: null,
        percentile: 50,
        weight: config.weight,
      };
      continue;
    }

    let percentile = computePercentileRank(value, sortedValues);

    // Invert percentile when lower values are better
    if (config.invert) {
      percentile = 100 - percentile;
    }

    breakdown[metricId] = { value, percentile, weight: config.weight };
    weightedSum += percentile * config.weight;
    usedWeight += config.weight;
    metricsUsed++;
  }

  if (metricsUsed === 0) {
    return null;
  }

  // Re-normalize score to account for missing metrics
  const matchScore =
    usedWeight > 0 ? Math.round((weightedSum / usedWeight) * 100) / 100 : 50;

  const budgetMatch = checkBudgetMatch(resolved, prefs);

  return {
    regionId,
    regionName: null,
    matchScore: Math.max(0, Math.min(100, matchScore)),
    metricsUsed,
    metricsTotal,
    budgetMatch,
    breakdown,
  };
}

/**
 * Compute percentile rank of a value within a sorted distribution.
 * Uses the (below + 0.5 * equal) / n formula. Returns 0-100.
 */
export function computePercentileRank(
  value: number,
  sortedValues: number[],
): number {
  const n = sortedValues.length;
  if (n === 0) return 50;

  let below = 0;
  let equal = 0;
  for (const v of sortedValues) {
    if (v < value) below++;
    else if (v === value) equal++;
  }

  const rank = ((below + 0.5 * equal) / n) * 100;
  return Math.max(0, Math.min(100, Math.round(rank * 100) / 100));
}

/**
 * Check if a region's home value falls within the user's budget range.
 * Returns true if no budget is set or if the value cannot be determined.
 */
export function checkBudgetMatch(
  resolved: Record<string, ResolvedMetric>,
  prefs: UserPreferences,
): boolean {
  if (!prefs.budget_min && !prefs.budget_max) {
    return true;
  }

  const homeValue =
    resolved['home_value']?.value ?? resolved['income_to_buy']?.value;

  if (homeValue === null || homeValue === undefined) {
    return true; // Can't determine, assume match
  }

  if (prefs.budget_min && homeValue < prefs.budget_min) {
    return false;
  }
  if (prefs.budget_max && homeValue > prefs.budget_max) {
    return false;
  }

  return true;
}
