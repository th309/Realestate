/**
 * PropertyIQ Scoring Service
 *
 * Orchestrates the PropertyIQ Score — a single demand-signal score built from
 * Zillow ZHVI price momentum (12-mo + 3-mo) and Realtor.com market-flow signals
 * (median days on market, price-reduced share). No Redfin. The signal is
 * z-scored cross-sectionally across all markets at a geography level (national
 * pool, NOT partitioned by state), percentile-ranked, and re-centered so the
 * scale is calibrated to 50 = the market's state average.
 *
 * Legacy score types (homeready, investoredge, markethealth) are no longer
 * computed but can still be read from historical DB rows.
 *
 * Delegates to:
 * - propertyiq-scoring-engine.ts: Demand-signal calculation (z-scores, percentile, re-centering)
 * - propertyiq-data-fetcher.ts: Zillow + Realtor metric assembly
 * - scoring-queries.ts: Score reads from propertyiq_scores table
 * - scoring-persistence.ts: Score writes (upsert with retry)
 * - scoring-distribution.ts: Score distribution analysis
 * - scoring-retrieval.ts: Single-location getScore / extended-history orchestration
 * - scoring-history-assembly.ts: Pure trend/history/stats transforms
 */

import { Injectable, Inject, Optional } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { GeographyChainService } from '../metric-resolution/geography-chain.service';
import { CalibrationService } from './calibration/calibration.service';
import { ScoreType, GeographyLevel } from './formula-weights';
import {
  GeographyType,
  LocationMetrics,
  ScoreResult,
  SingleScoreResult,
  ScoreComponentBreakdown,
  ScoreWithComponents,
  ComponentStatus,
} from './scoring.types';
import { getLatestRedfinDate, fetchAllMetrics } from './scoring-data-fetcher';
import {
  getTopMarkets as queryTopMarkets,
  searchMarkets as querySearchMarkets,
  getScoredLocationIds as queryScoredLocationIds,
} from './scoring-queries';
import {
  getScoreDistribution as queryScoreDistribution,
  getAllScoreDistributions as queryAllScoreDistributions,
} from './scoring-distribution';
import { calculateAndPersistPropertyIqScores } from './scoring-calculation';
import {
  getScoreForLocation,
  getScoreWithExtendedHistoryForLocation,
} from './scoring-retrieval';
import { computeMetricStats } from './scoring-history-assembly';
import {
  getAllScoresForGeographyPage,
  getAllScoresForGeographyBatched,
  iterateScoresForGeographyPages,
} from './scoring-pagination';

// Re-export types for consumers
export type {
  GeographyType,
  LocationMetrics,
  ScoreResult,
  SingleScoreResult,
  ScoreComponentBreakdown,
  ScoreWithComponents,
  ComponentStatus,
};

@Injectable()
export class ScoringService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly calibrationService: CalibrationService,
    @Optional() private readonly geoChainService?: GeographyChainService,
  ) {}

  // ============================================================================
  // Score Calculation
  // ============================================================================

  /**
   * Calculate scores for all locations at a given geography level.
   * Uses the demand-signal engine (single PropertyIQ score).
   */
  async calculateAllScores(
    geography: GeographyLevel,
    periodDate?: string,
  ): Promise<{ calculated: number; errors: number; scoreDate: string }> {
    return this.calculatePropertyIqScores(geography, periodDate);
  }

  /**
   * Calculate demand-signal scores for all locations at a given geography level.
   * Uses the 4 PropertyIQ formula inputs: zhvi_yoy and zhvi_mom_3m (derived from
   * Zillow ZHVI momentum) plus median_days_on_market and price_reduced_share
   * (Realtor.com market flow). Coverage is the union of Zillow and Realtor regions.
   */
  async calculatePropertyIqScores(
    geography: GeographyLevel,
    periodDate?: string,
  ): Promise<{ calculated: number; errors: number; scoreDate: string }> {
    return calculateAndPersistPropertyIqScores(
      this.supabase,
      geography,
      periodDate,
    );
  }

  // ============================================================================
  // Score Retrieval
  // ============================================================================

  /**
   * Get scores for a single location.
   * historyMonths > 0: fetches history, sets trend_change.
   * components === true: includes per-component breakdowns.
   */
  async getScore(
    locationId: string,
    geography: GeographyLevel,
    periodDate?: string,
    options?: { historyMonths?: number; components?: boolean },
  ): Promise<ScoreResult | null> {
    return getScoreForLocation(
      this.supabase,
      locationId,
      geography,
      periodDate,
      options,
    );
  }

  /**
   * Get score with extended history (up to 5 years) and outcome data.
   */
  async getScoreWithExtendedHistory(
    locationId: string,
    geography: GeographyLevel,
    options: { historyYears?: number; includeOutcomes?: boolean } = {},
  ): Promise<
    (ScoreResult & { extendedHistory?: any; validation?: any }) | null
  > {
    return getScoreWithExtendedHistoryForLocation(
      this.supabase,
      locationId,
      geography,
      options,
    );
  }

  // ============================================================================
  // Delegates to scoring-queries.ts
  // ============================================================================

  async getTopMarkets(
    geography: GeographyLevel,
    scoreType: ScoreType,
    limit: number = 10,
    periodDate?: string,
    state?: string,
    ascending: boolean = false,
  ) {
    return queryTopMarkets(
      this.supabase,
      geography,
      scoreType,
      limit,
      periodDate,
      state,
      ascending,
    );
  }

  async searchMarkets(
    query: string,
    geography?: GeographyLevel,
    limit: number = 20,
  ) {
    return querySearchMarkets(this.supabase, query, geography, limit);
  }

  /**
   * List every scored location_id for a geography (latest period by default).
   * Lean payload for SEO sitemap filtering + per-page noindex.
   */
  async getScoredLocationIds(
    geography: GeographyLevel,
    scoreType: ScoreType,
    periodDate?: string,
  ): Promise<{ date: string | null; ids: string[] }> {
    return queryScoredLocationIds(
      this.supabase,
      geography,
      scoreType,
      periodDate,
    );
  }

  /**
   * Distinct score_dates for a geography, newest-first, capped at `limit`.
   * Used by the monthly SEO slug rebuild to enumerate publish/redirect windows.
   *
   * Delegates to the `get_recent_score_periods` SQL function so Postgres
   * handles DISTINCT + ORDER + LIMIT server-side. A client-side .limit(5000)
   * approach fails at ZIP scale (~29 k rows/period) because the ordered slice
   * never leaves the most-recent month, returning only 1 distinct period.
   */
  async getScorePeriods(
    geoLevel: 'metro' | 'county' | 'zip',
    scoreType: string,
    limit: number,
  ): Promise<string[]> {
    const { data, error } = await this.supabase.rpc(
      'get_recent_score_periods',
      {
        p_geography: geoLevel,
        p_score_type: scoreType,
        p_limit: limit,
      },
    );
    if (error) throw error;
    return (data ?? []).map((d: unknown) =>
      typeof d === 'string'
        ? d.slice(0, 10)
        : new Date(d as string).toISOString().slice(0, 10),
    );
  }

  async getAllScoresForGeography(
    geography: GeographyLevel,
    scoreType: ScoreType,
    periodDate?: string,
    page: number = 0,
    pageSize: number = 1000,
  ) {
    return getAllScoresForGeographyPage(
      this.supabase,
      geography,
      scoreType,
      periodDate,
      page,
      pageSize,
    );
  }

  async getAllScoresForGeographyAll(
    geography: GeographyLevel,
    scoreType: ScoreType,
    periodDate?: string,
    pageSize: number = 1000,
    concurrency: number = 4,
  ) {
    return getAllScoresForGeographyBatched(
      this.supabase,
      geography,
      scoreType,
      periodDate,
      pageSize,
      concurrency,
    );
  }

  async *iterateScoresForGeography(
    geography: GeographyLevel,
    scoreType: ScoreType,
    periodDate?: string,
    pageSize: number = 1000,
  ) {
    yield* iterateScoresForGeographyPages(
      this.supabase,
      geography,
      scoreType,
      periodDate,
      pageSize,
    );
  }

  // ============================================================================
  // Delegates to scoring-distribution.ts
  // ============================================================================

  async getScoreDistribution(
    geography: GeographyLevel,
    scoreType: ScoreType,
    periodDate?: string,
  ) {
    return queryScoreDistribution(
      this.supabase,
      geography,
      scoreType,
      periodDate,
    );
  }

  async getAllScoreDistributions(
    geography: GeographyLevel,
    periodDate?: string,
  ) {
    return queryAllScoreDistributions(this.supabase, geography, periodDate);
  }

  // ============================================================================
  // Debug
  // ============================================================================

  async debugGetLatestDate(geography: GeographyLevel): Promise<string | null> {
    return getLatestRedfinDate(this.supabase, geography);
  }

  async debugGetMetricStats(
    geography: GeographyLevel,
    metricName: string,
    periodDate?: string,
  ): Promise<{
    count: number;
    min: number;
    max: number;
    mean: number;
    std: number;
  } | null> {
    const targetDate =
      periodDate || (await getLatestRedfinDate(this.supabase, geography));
    if (!targetDate) return null;

    const locations = await fetchAllMetrics(
      this.supabase,
      geography,
      targetDate,
    );
    return computeMetricStats(locations, metricName);
  }
}
