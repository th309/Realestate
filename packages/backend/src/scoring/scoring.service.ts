/**
 * PropertyIQ Scoring Service
 *
 * Orchestrates three scores for real estate markets using fixed ML-derived formulas:
 * - HomeReady: Predicts 3-year price appreciation for homebuyers
 * - InvestorEdge: Predicts total return (appreciation + rental yield) for investors
 * - MarketHealth: Current market conditions (how hot is the market)
 *
 * Delegates to:
 * - scoring-engine.ts: Pure math (z-scores, formulas, normalization, confidence)
 * - scoring-data-fetcher.ts: Data assembly from Realtor/Census/Economic tables
 * - scoring-queries.ts: Score reads from propertyiq_scores table
 * - scoring-persistence.ts: Score writes (upsert with retry)
 * - scoring-distribution.ts: Score distribution analysis
 */

import { Injectable, Inject, Optional } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { GeographyChainService } from '../metric-resolution/geography-chain.service';
import { CalibrationService } from './calibration/calibration.service';
import {
  FORMULA_WEIGHTS,
  scoreToGrade,
  ScoreType,
  GeographyLevel,
} from './formula-weights';
import {
  calculateV4Scores as runV4Engine,
  V4ScoreResult,
} from './v4-scoring-engine';
import { fetchV4Metrics } from './v4-scoring-data-fetcher';
import {
  GeographyType,
  LocationMetrics,
  ScoreResult,
  SingleScoreResult,
  ScoreComponentBreakdown,
  ScoreWithComponents,
  ComponentStatus,
  SCORE_HISTORY_MONTHS_MAX,
} from './scoring.types';
import {
  getAllMetricNames,
  calculateZScores,
  applyFormula,
  normalizeScores,
  calculateComponentBreakdown,
  calculateConfidence,
} from './scoring-engine';
import { getLatestRedfinDate, fetchAllMetrics } from './scoring-data-fetcher';
import {
  getLatestScoreDate,
  getScoreDatesForLocation,
  getScoreForDate,
  getLatestScoresForLocation,
  getOutcomesForLocation,
  getTopMarkets as queryTopMarkets,
  searchMarkets as querySearchMarkets,
  fetchScoresPage,
  fetchAllScoresBatched,
} from './scoring-queries';
import { saveScoresBatch, upsertScoresWithRetry } from './scoring-persistence';
import {
  getScoreDistribution as queryScoreDistribution,
  getAllScoreDistributions as queryAllScoreDistributions,
  ScoreDistributionResult,
} from './scoring-distribution';

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
   */
  async calculateAllScores(
    geography: GeographyLevel,
    periodDate?: string,
  ): Promise<{ calculated: number; errors: number; scoreDate: string }> {
    const targetDate =
      periodDate || (await getLatestRedfinDate(this.supabase, geography));
    if (!targetDate) {
      return { calculated: 0, errors: 0, scoreDate: '' };
    }

    const locations = await fetchAllMetrics(
      this.supabase,
      geography,
      targetDate,
    );
    if (locations.length === 0) {
      return { calculated: 0, errors: 0, scoreDate: targetDate };
    }

    const allMetricNames = getAllMetricNames(geography);
    const zScores = calculateZScores(locations, allMetricNames);

    const scoreTypes: ScoreType[] = [
      'homeready',
      'investoredge',
      'markethealth',
    ];
    const allResults: ScoreResult[] = [];

    for (const scoreType of scoreTypes) {
      const formula = FORMULA_WEIGHTS[geography][scoreType];
      const rawScores = applyFormula(locations, zScores, formula);
      const rawNormalized = normalizeScores(rawScores);
      const normalizedScores = rawNormalized.map((score) =>
        this.calibrationService.calibrate(score, scoreType, geography),
      );

      for (let i = 0; i < locations.length; i++) {
        const location = locations[i];
        const score = normalizedScores[i];
        const grade = scoreToGrade(score);
        const { confidence, level } = calculateConfidence(
          location,
          geography,
          scoreType,
        );

        let result = allResults.find(
          (r) => r.location_id === location.location_id,
        );
        if (!result) {
          result = {
            location_id: location.location_id,
            location_name: location.location_name,
            geography,
            median_price: location.median_price ?? null,
            score_date: targetDate,
            scores: {
              homeready: {
                score: 0,
                grade: 'F',
                confidence: 0,
                confidence_level: 'F',
              },
              investoredge: {
                score: 0,
                grade: 'F',
                confidence: 0,
                confidence_level: 'F',
              },
              markethealth: {
                score: 0,
                grade: 'F',
                confidence: 0,
                confidence_level: 'F',
              },
              propertyiq: null,
            },
            z_scores: zScores[location.location_id] || {},
          };
          allResults.push(result);
        }

        result.scores[scoreType] = {
          score,
          grade,
          confidence,
          confidence_level: level,
        };
      }
    }

    const { calculated, errors } = await saveScoresBatch(
      this.supabase,
      allResults,
      targetDate,
    );
    return { calculated, errors, scoreDate: targetDate };
  }

  /**
   * Calculate v4 demand-signal scores for all locations at a given geography level.
   * Uses only 3 Redfin metrics (sold_above_list, median_dom, months_of_supply).
   */
  async calculateV4Scores(
    geography: GeographyLevel,
    periodDate?: string,
  ): Promise<{ calculated: number; errors: number; scoreDate: string }> {
    // 1. Get latest Redfin date if not specified
    const scoreDate =
      periodDate || (await getLatestRedfinDate(this.supabase, geography));
    if (!scoreDate) {
      throw new Error(`No Redfin data found for ${geography}`);
    }

    // 2. Fetch only v4 metrics (3 Redfin columns)
    const locations = await fetchV4Metrics(this.supabase, geography, scoreDate);
    if (locations.length === 0) {
      return { calculated: 0, errors: 0, scoreDate };
    }

    // 3. Calculate scores using v4 engine
    const results = runV4Engine(locations, geography);

    // 4. Build rows for persistence
    // Note: formula_version is NOT a column in propertyiq_scores_v2 — omit it.
    // The version is tracked via score_type='propertyiq' which is implicitly v4.
    const rows = results.map((r) => ({
      geography,
      location_id: r.locationId,
      location_name: r.locationName,
      score_type: 'propertyiq' as const,
      score: r.score,
      grade: r.grade,
      confidence: r.confidence,
      confidence_level: r.confidenceLevel,
      median_price: r.medianPrice,
      score_date: scoreDate,
      created_at: new Date().toISOString(),
      z_scores: JSON.stringify(r.inputMetrics),
    }));

    // 5. Persist
    await upsertScoresWithRetry(this.supabase, rows);

    return { calculated: results.length, errors: 0, scoreDate };
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
    // When no date is specified, fetch the latest row per score_type
    // to handle v3/v4 date mismatches (different score types may have
    // been calculated on different dates).
    let result: ScoreResult | null;
    let targetDate: string;

    if (periodDate) {
      targetDate = periodDate;
      result = await getScoreForDate(
        this.supabase,
        locationId,
        geography,
        targetDate,
      );
    } else {
      result = await getLatestScoresForLocation(
        this.supabase,
        locationId,
        geography,
      );
      if (!result) return null;
      targetDate = result.score_date;
    }
    if (!result) return null;

    // Attach component breakdowns if requested
    if (options?.components && result.z_scores) {
      const zs = result.z_scores;
      const rawValues: Record<string, number | null> = {};
      for (const key of Object.keys(zs)) {
        rawValues[key] = null;
      }
      for (const scoreType of [
        'homeready',
        'investoredge',
        'markethealth',
      ] as const) {
        const scoreData = result.scores[scoreType];
        if (scoreData && scoreData.score > 0) {
          scoreData.components = calculateComponentBreakdown(
            scoreType,
            geography,
            zs,
            rawValues,
          );
        }
      }
      // Note: propertyiq uses v4 engine with its own metrics — no v3 component breakdown
    }

    const rawMonths = options?.historyMonths ?? 0;
    const historyMonths = Math.min(
      Math.max(0, rawMonths),
      SCORE_HISTORY_MONTHS_MAX,
    );
    if (historyMonths <= 0) return result;

    const dates = await getScoreDatesForLocation(
      this.supabase,
      locationId,
      geography,
      (historyMonths + 1) * 3,
    );
    if (!dates.length || dates[0] !== targetDate) return result;

    const historyByDate: Array<{ date: string; result: ScoreResult }> = [];
    for (const d of dates) {
      const r = await getScoreForDate(this.supabase, locationId, geography, d);
      if (r) historyByDate.push({ date: d, result: r });
    }
    if (historyByDate.length < 2) return result;

    const priorResult = historyByDate[1]?.result;
    if (!priorResult) return result;

    for (const key of [
      'homeready',
      'investoredge',
      'markethealth',
      'propertyiq',
    ] as const) {
      const curr = result.scores[key];
      if (!curr) continue;
      const prev = priorResult.scores[key];
      const change =
        curr &&
        prev &&
        typeof curr.score === 'number' &&
        typeof prev.score === 'number'
          ? Number((curr.score - prev.score).toFixed(1))
          : 0;
      curr.trend_change = change;

      const data = historyByDate.map(({ date, result: r }) => ({
        date,
        score: r.scores[key]?.score ?? null,
      }));
      const trend: 'up' | 'down' | 'stable' =
        change > 0.01 ? 'up' : change < -0.01 ? 'down' : 'stable';
      curr.history = {
        data,
        months: historyMonths,
        trend,
        change,
      };
    }
    return result;
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
    const { historyYears = 3, includeOutcomes = false } = options;
    const targetDate = await getLatestScoreDate(this.supabase, geography);
    if (!targetDate) return null;

    const result = await getScoreForDate(
      this.supabase,
      locationId,
      geography,
      targetDate,
    );
    if (!result) return null;

    const monthsToFetch = Math.min(historyYears * 12, 60);
    const allDates = await getScoreDatesForLocation(
      this.supabase,
      locationId,
      geography,
      monthsToFetch,
    );
    if (allDates.length === 0) return result;

    const historyByDate: Array<{ date: string; result: ScoreResult }> = [];
    for (const d of allDates) {
      const r = await getScoreForDate(this.supabase, locationId, geography, d);
      if (r) historyByDate.push({ date: d, result: r });
    }
    if (historyByDate.length < 2) return result;

    let outcomes: Map<string, any> = new Map();
    if (includeOutcomes) {
      outcomes = await getOutcomesForLocation(
        this.supabase,
        locationId,
        geography,
      );
    }

    for (const key of [
      'homeready',
      'investoredge',
      'markethealth',
      'propertyiq',
    ] as const) {
      const curr = result.scores[key];
      if (!curr) continue;
      const oldest =
        historyByDate[historyByDate.length - 1]?.result.scores[key];
      const scoreChange =
        curr &&
        oldest &&
        typeof curr.score === 'number' &&
        typeof oldest.score === 'number'
          ? Number((curr.score - oldest.score).toFixed(1))
          : 0;
      const trend: 'up' | 'down' | 'stable' =
        scoreChange > 2 ? 'up' : scoreChange < -2 ? 'down' : 'stable';

      const historyData = historyByDate.map(({ date, result: r }) => {
        const outcomeData = outcomes.get(date);
        return {
          date,
          score: r.scores[key]?.score ?? null,
          actualReturn1Y: outcomeData?.return1y,
          actualReturn3Y: outcomeData?.return3y,
          benchmarkReturn1Y: outcomeData?.stateReturn1y,
          benchmarkReturn3Y: outcomeData?.stateReturn3y,
          excessReturn3Y: outcomeData?.excessVsState3y,
        };
      });

      (curr as any).extendedHistory = {
        data: historyData,
        years: historyYears,
        trend,
        scoreChange,
      };

      if (includeOutcomes) {
        const latestOutcome = outcomes.get(allDates[allDates.length - 1]);
        if (latestOutcome?.excessVsState3y != null) {
          (curr as any).validation = {
            hasOutcomes: true,
            excessReturn3Y: latestOutcome.excessVsState3y,
            predictedVsActual:
              latestOutcome.excessVsState3y > 2
                ? 'outperformed'
                : latestOutcome.excessVsState3y < -2
                  ? 'underperformed'
                  : 'matched',
          };
        } else {
          (curr as any).validation = { hasOutcomes: false };
        }
      }
    }
    return result as any;
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
  ) {
    return queryTopMarkets(
      this.supabase,
      geography,
      scoreType,
      limit,
      periodDate,
      state,
    );
  }

  async searchMarkets(
    query: string,
    geography?: GeographyLevel,
    limit: number = 20,
  ) {
    return querySearchMarkets(this.supabase, query, geography, limit);
  }

  async getAllScoresForGeography(
    geography: GeographyLevel,
    scoreType: ScoreType,
    periodDate?: string,
    page: number = 0,
    pageSize: number = 1000,
  ) {
    const targetDate =
      periodDate || (await getLatestScoreDate(this.supabase, geography));
    if (!targetDate) {
      return { data: [], total: 0, page, pageSize, hasMore: false };
    }

    const { count: total } = await this.supabase
      .from('propertyiq_scores')
      .select('*', { count: 'exact', head: true })
      .eq('geography', geography)
      .eq('score_type', scoreType)
      .eq('score_date', targetDate);

    const { data } = await fetchScoresPage(
      this.supabase,
      geography,
      scoreType,
      targetDate,
      page * pageSize,
      (page + 1) * pageSize - 1,
    );

    return {
      data: data || [],
      total: total || 0,
      page,
      pageSize,
      hasMore: (page + 1) * pageSize < (total || 0),
    };
  }

  async getAllScoresForGeographyAll(
    geography: GeographyLevel,
    scoreType: ScoreType,
    periodDate?: string,
    pageSize: number = 1000,
    concurrency: number = 4,
  ) {
    const targetDate =
      periodDate || (await getLatestScoreDate(this.supabase, geography));
    if (!targetDate) {
      return { data: [], total: 0, pageSize };
    }
    const { data, total } = await fetchAllScoresBatched(
      this.supabase,
      geography,
      scoreType,
      targetDate,
      pageSize,
      concurrency,
    );
    return { data, total: total || data.length, pageSize };
  }

  async *iterateScoresForGeography(
    geography: GeographyLevel,
    scoreType: ScoreType,
    periodDate?: string,
    pageSize: number = 1000,
  ) {
    const targetDate =
      periodDate || (await getLatestScoreDate(this.supabase, geography));
    if (!targetDate) return;

    let page = 0;
    while (true) {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      const { data } = await fetchScoresPage(
        this.supabase,
        geography,
        scoreType,
        targetDate,
        from,
        to,
      );
      if (!data || data.length === 0) break;
      yield data;
      if (data.length < pageSize) break;
      page += 1;
    }
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
    const values = locations
      .map((l) => (l as any)[metricName])
      .filter((v) => v !== null && v !== undefined && !isNaN(v));

    if (values.length === 0) return null;

    const mean =
      values.reduce((a: number, b: number) => a + b, 0) / values.length;
    const variance =
      values.reduce((a: number, b: number) => a + Math.pow(b - mean, 2), 0) /
      values.length;

    return {
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      mean: Math.round(mean * 100) / 100,
      std: Math.round(Math.sqrt(variance) * 100) / 100,
    };
  }
}
