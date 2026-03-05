/**
 * Market Match Service
 *
 * Calculates how well each market matches a user's quiz preferences.
 * Orchestrates data fetching and delegates computation to helper modules:
 * - match-weights.ts: Priority → metric weight merging
 * - match-source-routing.ts: Metric → DB table/column routing
 * - match-score-calculator.ts: Percentile ranking and weighted scoring
 *
 * Flow:
 * 1. Load user preferences (priorities, budget range)
 * 2. Merge priority categories into a normalized weight map
 * 3. Bulk-fetch metric values for all regions at the geo level
 * 4. Compute percentile-based weighted score (0-100) per region
 * 5. Filter by budget constraints
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { MetricResolutionService } from '../metric-resolution/metric-resolution.service';
import { GeoLevel } from '../metric-resolution/metric-resolution.types';
import { PreferencesService } from './preferences.service';
import { mergePriorityWeights } from './match-weights';
import { getMatchSourceTable } from './match-source-routing';
import {
  MatchScoreResult,
  buildPercentileLookup,
  extractRegionIds,
  extractRegionData,
  computeMatchScore,
} from './match-score-calculator';

export type { MatchScoreResult } from './match-score-calculator';

@Injectable()
export class MarketMatchService {
  private readonly logger = new Logger(MarketMatchService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly metricResolution: MetricResolutionService,
    private readonly preferencesService: PreferencesService,
  ) {}

  /**
   * Calculate match score for a single region against a user's preferences.
   */
  async calculateMatchScore(
    userId: string,
    geoLevel: string,
    regionId: string,
  ): Promise<MatchScoreResult | null> {
    const prefs = await this.preferencesService.getPreferences(userId);
    if (!prefs || !prefs.priorities?.length) {
      this.logger.warn(`No preferences found for user ${userId}`);
      return null;
    }

    const weightMap = mergePriorityWeights(prefs.priorities);
    if (Object.keys(weightMap).length === 0) {
      return null;
    }

    const geo = geoLevel as GeoLevel;
    const metricIds = Object.keys(weightMap);

    // Fetch distribution data for percentile calculation
    const allRegionValues = await this.fetchAllRegionMetrics(metricIds, geo);
    const percentileLookup = buildPercentileLookup(allRegionValues, metricIds);

    // Resolve metrics for the target region via MetricResolutionService
    const resolved = await this.metricResolution.resolveMetricBatch(
      metricIds,
      geo,
      regionId,
    );

    return computeMatchScore(
      regionId,
      resolved,
      weightMap,
      percentileLookup,
      prefs,
    );
  }

  /**
   * Calculate match scores for all regions at a geo level, sorted descending.
   */
  async calculateMatchScoresAll(
    userId: string,
    geoLevel: string,
  ): Promise<MatchScoreResult[]> {
    const prefs = await this.preferencesService.getPreferences(userId);
    if (!prefs || !prefs.priorities?.length) {
      return [];
    }

    const weightMap = mergePriorityWeights(prefs.priorities);
    if (Object.keys(weightMap).length === 0) {
      return [];
    }

    const geo = geoLevel as GeoLevel;
    const metricIds = Object.keys(weightMap);

    const allRegionValues = await this.fetchAllRegionMetrics(metricIds, geo);
    const percentileLookup = buildPercentileLookup(allRegionValues, metricIds);
    const regionIds = extractRegionIds(allRegionValues);

    const results: MatchScoreResult[] = [];
    for (const rid of regionIds) {
      const resolved = extractRegionData(allRegionValues, rid, metricIds);
      const score = computeMatchScore(
        rid,
        resolved,
        weightMap,
        percentileLookup,
        prefs,
      );
      if (score) {
        results.push(score);
      }
    }

    results.sort((a, b) => b.matchScore - a.matchScore);
    return results;
  }

  /**
   * Get the top N matching markets for a user.
   */
  async getTopMatches(
    userId: string,
    geoLevel: string,
    limit: number = 10,
  ): Promise<MatchScoreResult[]> {
    const all = await this.calculateMatchScoresAll(userId, geoLevel);
    return all.slice(0, limit);
  }

  // ==========================================================================
  // Internal: Bulk Data Fetching
  // ==========================================================================

  /**
   * Fetch latest values for multiple metrics across all regions at a geo level.
   * Returns Map<metricId, Map<regionId, value>>.
   */
  private async fetchAllRegionMetrics(
    metricIds: string[],
    geoLevel: GeoLevel,
  ): Promise<Map<string, Map<string, number>>> {
    const result = new Map<string, Map<string, number>>();

    // Fetch each metric in parallel
    const entries = await Promise.all(
      metricIds.map(async (metricId) => {
        const values = await this.fetchMetricForAllRegions(metricId, geoLevel);
        return [metricId, values] as const;
      }),
    );

    for (const [metricId, values] of entries) {
      result.set(metricId, values);
    }

    return result;
  }

  /**
   * Fetch a single metric's latest values for all regions at a geo level.
   * Queries the primary source table directly, deduplicating by region.
   */
  private async fetchMetricForAllRegions(
    metricId: string,
    geoLevel: GeoLevel,
  ): Promise<Map<string, number>> {
    const values = new Map<string, number>();

    const tableConfig = getMatchSourceTable(metricId, geoLevel);
    if (!tableConfig) return values;

    const { data, error } = await this.supabase
      .from(tableConfig.table)
      .select(`${tableConfig.idColumn}, ${tableConfig.valueColumn}`)
      .not(tableConfig.valueColumn, 'is', null)
      .order('period_date', { ascending: false })
      .limit(5000);

    if (error) {
      this.logger.warn(
        `Failed to fetch ${metricId} from ${tableConfig.table}: ${error.message}`,
      );
      return values;
    }

    if (!data) return values;

    // Deduplicate: keep the latest value per region (rows ordered by date desc)
    const seen = new Set<string>();
    for (const row of data) {
      const regionId = String(row[tableConfig.idColumn] ?? '');
      if (!regionId || seen.has(regionId)) continue;
      seen.add(regionId);

      const rawValue = row[tableConfig.valueColumn];
      const numValue =
        typeof rawValue === 'number' ? rawValue : parseFloat(String(rawValue));

      if (!isNaN(numValue) && isFinite(numValue)) {
        values.set(regionId, numValue);
      }
    }

    return values;
  }
}
