/**
 * PropertyIQ Scoring Service
 *
 * Calculates three scores for real estate markets using fixed ML-derived formulas:
 * - HomeReady: Predicts 3-year price appreciation for homebuyers
 * - InvestorEdge: Predicts total return (appreciation + rental yield) for investors
 * - MarketHealth: Current market conditions (how hot is the market)
 *
 * Scoring methodology (from SCORING_SYSTEM_SPEC.md):
 * 1. Fetch all locations with their metrics for a geography level
 * 2. Calculate z-scores for each metric across all locations
 * 3. Apply fixed formula weights (direction × weight × z-score)
 * 4. Normalize raw scores to 0-100 range
 * 5. Convert to letter grades (A+ to F)
 * 6. Calculate 4-factor confidence score
 */

import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import {
  FORMULA_WEIGHTS,
  COMPONENT_GROUPS,
  MODEL_CORRELATIONS,
  SAMPLE_SIZE_SCORES,
  scoreToGrade,
  getConfidenceLevel,
  ScoreType,
  GeographyLevel,
  FormulaDefinition,
  ConfidenceLevel,
} from './formula-weights';
import {
  GeographyType,
  LocationMetrics,
  ScoreResult,
  SingleScoreResult,
  ScoreComponentBreakdown,
  ScoreWithComponents,
  ComponentStatus,
  SCORE_HISTORY_MONTHS_MAX,
  ScoreHistoryResult,
} from './scoring.types';

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

interface ZScoreMap {
  [locationId: string]: { [metricName: string]: number };
}

interface RawScoreResult {
  locationId: string;
  rawScore: number;
}

const CALCULATION_VERSION = '3.0.0'; // New simplified version

@Injectable()
export class ScoringService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) { }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Calculate scores for all locations at a given geography level
   */
  async calculateAllScores(
    geography: GeographyLevel,
    periodDate?: string,
  ): Promise<{ calculated: number; errors: number; scoreDate: string }> {
    // Get the latest date if not provided
    const targetDate = periodDate || (await this.getLatestDate(geography));
    if (!targetDate) {
      return { calculated: 0, errors: 0, scoreDate: '' };
    }

    // 1. Fetch all locations with their metrics
    const locations = await this.fetchAllMetrics(geography, targetDate);
    if (locations.length === 0) {
      return { calculated: 0, errors: 0, scoreDate: targetDate };
    }

    // 2. For ZIP level, inherit county data for missing census metrics
    if (geography === 'zip') {
      await this.inheritCountyData(locations);
    }

    // 3. Calculate z-scores for all metrics across all locations
    const allMetricNames = this.getAllMetricNames(geography);
    const zScores = this.calculateZScores(locations, allMetricNames);

    // 4. Calculate raw scores for each score type
    const scoreTypes: ScoreType[] = ['homeready', 'investoredge', 'markethealth'];
    const allResults: ScoreResult[] = [];

    for (const scoreType of scoreTypes) {
      const formula = FORMULA_WEIGHTS[geography][scoreType];
      const rawScores = this.applyFormula(locations, zScores, formula);

      // 5. Normalize to 0-100
      const normalizedScores = this.normalizeScores(rawScores);

      // 6. Build results with grades and confidence
      for (let i = 0; i < locations.length; i++) {
        const location = locations[i];
        const score = normalizedScores[i];
        const grade = scoreToGrade(score);
        const { confidence, level } = this.calculateConfidence(
          location,
          geography,
          scoreType,
        );

        // Find or create result for this location
        let result = allResults.find(r => r.location_id === location.location_id);
        if (!result) {
          result = {
            location_id: location.location_id,
            location_name: location.location_name,
            geography,
            median_price: location.median_price ?? null,
            score_date: targetDate,
            scores: {
              homeready: { score: 0, grade: 'F', confidence: 0, confidence_level: 'INSUFFICIENT' },
              investoredge: { score: 0, grade: 'F', confidence: 0, confidence_level: 'INSUFFICIENT' },
              markethealth: { score: 0, grade: 'F', confidence: 0, confidence_level: 'INSUFFICIENT' },
            },
            z_scores: zScores[location.location_id] || {},
          };
          allResults.push(result);
        }

        result.scores[scoreType] = { score, grade, confidence, confidence_level: level };
      }
    }

    // 7. Save all scores to database (batch + retry for reliability)
    const { calculated, errors } = await this.saveScoresBatch(allResults, targetDate);

    return { calculated, errors, scoreDate: targetDate };
  }

  /**
   * Get scores for a single location.
   * When historyMonths > 0 (max SCORE_HISTORY_MONTHS_MAX), fetches up to 6 months of history,
   * sets trend_change (current - prior period) and attaches history for frontend real-time calculations.
   * When components === true, includes per-component score breakdowns for each score type.
   */
  async getScore(
    locationId: string,
    geography: GeographyLevel,
    periodDate?: string,
    options?: { historyMonths?: number; components?: boolean },
  ): Promise<ScoreResult | null> {
    const targetDate = periodDate || (await this.getLatestScoreDate(geography));
    if (!targetDate) return null;

    const result = await this.getScoreForDate(locationId, geography, targetDate);
    if (!result) return null;

    // Attach component breakdowns if requested
    if (options?.components && result.z_scores) {
      const zScores = result.z_scores;
      // Build a raw values map from z_scores keys (raw values aren't stored in DB,
      // so we pass null — the z_scores are what matter for the breakdown calculation)
      const rawValues: Record<string, number | null> = {};
      for (const key of Object.keys(zScores)) {
        rawValues[key] = null;
      }

      for (const scoreType of ['homeready', 'investoredge', 'markethealth'] as const) {
        const scoreData = result.scores[scoreType];
        if (scoreData && scoreData.score > 0) {
          scoreData.components = this.calculateComponentBreakdown(
            scoreType,
            geography,
            zScores,
            rawValues,
          );
        }
      }
    }

    const rawMonths = options?.historyMonths ?? 0;
    const historyMonths = Math.min(Math.max(0, rawMonths), SCORE_HISTORY_MONTHS_MAX);
    if (historyMonths <= 0) return result;

    const dates = await this.getScoreDates(geography, historyMonths + 1);
    if (!dates.length || dates[0] !== targetDate) {
      if (historyMonths > 0) {
        console.debug(
          `[Scoring] trend skipped: no history (dates=${dates.length}, target=${targetDate}) ${geography}/${locationId}`,
        );
      }
      return result;
    }

    const historyByDate: Array<{ date: string; result: ScoreResult }> = [];
    for (const d of dates) {
      const r = await this.getScoreForDate(locationId, geography, d);
      if (r) historyByDate.push({ date: d, result: r });
    }
    if (historyByDate.length < 2) {
      console.debug(
        `[Scoring] trend skipped: need 2+ dates with data, got ${historyByDate.length} ${geography}/${locationId}`,
      );
      return result;
    }

    const scores = result.scores;
    const priorResult = historyByDate[1]?.result;
    if (!priorResult) return result;

    for (const key of ['homeready', 'investoredge', 'markethealth'] as const) {
      const curr = scores[key];
      const prev = priorResult.scores[key];
      const change =
        curr && prev && typeof curr.score === 'number' && typeof prev.score === 'number'
          ? Number((curr.score - prev.score).toFixed(1))
          : 0;
      (curr as SingleScoreResult).trend_change = change;

      const data = historyByDate.map(({ date, result: r }) => ({
        date,
        score: r.scores[key]?.score ?? null,
      }));
      const trend: 'up' | 'down' | 'stable' = change > 0.01 ? 'up' : change < -0.01 ? 'down' : 'stable';
      (curr as SingleScoreResult).history = {
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
   * Used for historical score tracking and validation displays.
   */
  async getScoreWithExtendedHistory(
    locationId: string,
    geography: GeographyLevel,
    options: {
      historyYears?: number;
      includeOutcomes?: boolean;
    } = {},
  ): Promise<ScoreResult & {
    extendedHistory?: {
      data: Array<{
        date: string;
        score: number | null;
        actualReturn1Y?: number | null;
        actualReturn3Y?: number | null;
        benchmarkReturn1Y?: number | null;
        benchmarkReturn3Y?: number | null;
        excessReturn3Y?: number | null;
      }>;
      years: number;
      trend: 'up' | 'down' | 'stable';
      scoreChange: number;
    };
    validation?: {
      hasOutcomes: boolean;
      excessReturn3Y?: number;
      predictedVsActual?: 'outperformed' | 'underperformed' | 'matched';
    };
  } | null> {
    const { historyYears = 3, includeOutcomes = false } = options;
    const targetDate = await this.getLatestScoreDate(geography);
    if (!targetDate) return null;

    const result = await this.getScoreForDate(locationId, geography, targetDate);
    if (!result) return null;

    // Calculate how many months to fetch
    const monthsToFetch = Math.min(historyYears * 12, 60);

    // Get all score dates for this location (up to N years)
    const allDates = await this.getScoreDatesForLocation(locationId, geography, monthsToFetch);
    if (allDates.length === 0) return result;

    // Fetch scores for each date
    const historyByDate: Array<{ date: string; result: ScoreResult }> = [];
    for (const d of allDates) {
      const r = await this.getScoreForDate(locationId, geography, d);
      if (r) historyByDate.push({ date: d, result: r });
    }

    // If no history, return basic result
    if (historyByDate.length < 2) return result;

    // Get outcomes if requested
    let outcomes: Map<string, {
      return1y?: number;
      return3y?: number;
      stateReturn1y?: number;
      stateReturn3y?: number;
      excessVsState3y?: number;
    }> = new Map();

    if (includeOutcomes) {
      outcomes = await this.getOutcomesForLocation(locationId, geography);
    }

    // Build extended history for each score type
    for (const key of ['homeready', 'investoredge', 'markethealth'] as const) {
      const curr = result.scores[key];
      const oldest = historyByDate[historyByDate.length - 1]?.result.scores[key];

      const scoreChange =
        curr && oldest && typeof curr.score === 'number' && typeof oldest.score === 'number'
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

      // Add validation data if outcomes available
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

  /**
   * Get score dates for a specific location (newest first).
   */
  private async getScoreDatesForLocation(
    locationId: string,
    geography: GeographyLevel,
    limit: number,
  ): Promise<string[]> {
    const { data } = await this.supabase
      .from('propertyiq_scores')
      .select('score_date')
      .eq('geography', geography)
      .eq('location_id', locationId)
      .order('score_date', { ascending: false })
      .limit(limit);

    if (!data?.length) return [];
    return [...new Set(data.map((r: { score_date: string }) => r.score_date))].sort(
      (a, b) => b.localeCompare(a),
    );
  }

  /**
   * Get outcomes for a location from backtest table.
   */
  private async getOutcomesForLocation(
    locationId: string,
    geography: GeographyLevel,
  ): Promise<Map<string, {
    return1y?: number;
    return3y?: number;
    stateReturn1y?: number;
    stateReturn3y?: number;
    excessVsState3y?: number;
  }>> {
    const { data } = await this.supabase
      .from('propertyiq_backtest_outcomes')
      .select('score_date, outcome_1y_value, outcome_3y_value, state_return_1y, state_return_3y_cagr, excess_vs_state_3y')
      .eq('geography_id', locationId)
      .eq('geography_type', geography)
      .order('score_date', { ascending: false });

    const outcomes = new Map<string, any>();
    if (data) {
      for (const row of data) {
        outcomes.set(row.score_date, {
          return1y: row.outcome_1y_value,
          return3y: row.outcome_3y_value,
          stateReturn1y: row.state_return_1y,
          stateReturn3y: row.state_return_3y_cagr,
          excessVsState3y: row.excess_vs_state_3y,
        });
      }
    }
    return outcomes;
  }

  /**
   * Get distinct score_dates for a geography (newest first), up to limit.
   */
  private async getScoreDates(geography: GeographyLevel, limit: number): Promise<string[]> {
    const { data } = await this.supabase
      .from('propertyiq_scores')
      .select('score_date')
      .eq('geography', geography)
      .order('score_date', { ascending: false })
      .limit(limit * 4);

    if (!data?.length) return [];
    const dates = [...new Set(data.map((r: { score_date: string }) => r.score_date))].sort(
      (a, b) => b.localeCompare(a),
    );
    return dates.slice(0, limit);
  }

  /**
   * Fetch scores for one location at a single score_date (no trend).
   */
  private async getScoreForDate(
    locationId: string,
    geography: GeographyLevel,
    scoreDate: string,
  ): Promise<ScoreResult | null> {
    let query = this.supabase
      .from('propertyiq_scores')
      .select('*')
      .eq('geography', geography)
      .eq('score_date', scoreDate);

    if (/^\d+$/.test(locationId)) {
      query = query.eq('location_id', locationId);
    } else {
      query = query.ilike('location_name', `${locationId}%`);
    }

    const { data } = await query;
    if (!data || data.length === 0) return null;

    const scoresByType: Record<ScoreType, SingleScoreResult> = {
      homeready: null!,
      investoredge: null!,
      markethealth: null!,
    };
    let locationName = '';
    let medianPrice: number | null = null;
    let zScores: Record<string, number> | undefined;

    for (const row of data) {
      locationName = row.location_name || locationName;
      medianPrice = row.median_price ?? medianPrice;
      // z_scores are the same across all score types for a location; grab from first row that has them
      if (!zScores && row.z_scores && typeof row.z_scores === 'object') {
        zScores = row.z_scores;
      }
      const scoreType = row.score_type as ScoreType;
      scoresByType[scoreType] = {
        score: row.score,
        grade: row.grade,
        confidence: row.confidence,
        confidence_level: row.confidence_level,
      };
    }

    return {
      location_id: locationId,
      location_name: locationName,
      geography,
      median_price: medianPrice,
      score_date: scoreDate,
      scores: {
        homeready: scoresByType.homeready || { score: 0, grade: 'F', confidence: 0, confidence_level: 'INSUFFICIENT' },
        investoredge: scoresByType.investoredge || { score: 0, grade: 'F', confidence: 0, confidence_level: 'INSUFFICIENT' },
        markethealth: scoresByType.markethealth || { score: 0, grade: 'F', confidence: 0, confidence_level: 'INSUFFICIENT' },
      },
      z_scores: zScores,
      return_1y: data[0]?.return_1y,
      return_3y_ann: data[0]?.return_3y_ann,
    };
  }

  /**
   * Get top markets by score
   */
  async getTopMarkets(
    geography: GeographyLevel,
    scoreType: ScoreType,
    limit: number = 10,
    periodDate?: string,
  ): Promise<Array<{ location_id: string; location_name: string; score: number; grade: string }>> {
    const targetDate = periodDate || (await this.getLatestScoreDate(geography));
    if (!targetDate) return [];

    const { data } = await this.supabase
      .from('propertyiq_scores')
      .select('location_id, location_name, score, grade')
      .eq('geography', geography)
      .eq('score_type', scoreType)
      .eq('score_date', targetDate)
      .order('score', { ascending: false })
      .limit(limit);

    return data || [];
  }

  /**
   * Get all scores for a geography level (for map display)
   * Returns paginated results with all three score types
   */
  async getAllScoresForGeography(
    geography: GeographyLevel,
    scoreType: ScoreType,
    periodDate?: string,
    page: number = 0,
    pageSize: number = 1000,
  ): Promise<{
    data: Array<{
      location_id: string;
      location_name: string;
      score: number;
      grade: string;
      confidence: number;
      confidence_level: string;
    }>;
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  }> {
    const targetDate = periodDate || (await this.getLatestScoreDate(geography));
    if (!targetDate) {
      return { data: [], total: 0, page, pageSize, hasMore: false };
    }

    // Get total count
    const { count: total } = await this.supabase
      .from('propertyiq_scores')
      .select('*', { count: 'exact', head: true })
      .eq('geography', geography)
      .eq('score_type', scoreType)
      .eq('score_date', targetDate);

    // Fetch paginated data
    const { data, error } = await this.supabase
      .from('propertyiq_scores')
      .select('location_id, location_name, score, grade, confidence, confidence_level')
      .eq('geography', geography)
      .eq('score_type', scoreType)
      .eq('score_date', targetDate)
      .order('score', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      throw new Error(`Failed to fetch scores: ${error.message}`);
    }

    return {
      data: data || [],
      total: total || 0,
      page,
      pageSize,
      hasMore: (page + 1) * pageSize < (total || 0),
    };
  }

  private async fetchScoresPage(
    geography: GeographyLevel,
    scoreType: ScoreType,
    scoreDate: string,
    from: number,
    to: number,
  ): Promise<{
    data: Array<{
      location_id: string;
      location_name: string;
      score: number;
      grade: string;
      confidence: number;
      confidence_level: string;
    }>;
  }> {
    const { data, error } = await this.supabase
      .from('propertyiq_scores')
      .select('location_id, location_name, score, grade, confidence, confidence_level')
      .eq('geography', geography)
      .eq('score_type', scoreType)
      .eq('score_date', scoreDate)
      .order('score', { ascending: false })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to fetch scores: ${error.message}`);
    }

    return { data: data || [] };
  }

  private async fetchAllScoresBatched(
    geography: GeographyLevel,
    scoreType: ScoreType,
    scoreDate: string,
    pageSize: number,
    concurrency: number,
  ): Promise<{
    data: Array<{
      location_id: string;
      location_name: string;
      score: number;
      grade: string;
      confidence: number;
      confidence_level: string;
    }>;
    total: number | null;
  }> {
    const { count: total } = await this.supabase
      .from('propertyiq_scores')
      .select('*', { count: 'exact', head: true })
      .eq('geography', geography)
      .eq('score_type', scoreType)
      .eq('score_date', scoreDate);

    if (!total || total <= pageSize || concurrency <= 1) {
      const all: Array<{
        location_id: string;
        location_name: string;
        score: number;
        grade: string;
        confidence: number;
        confidence_level: string;
      }> = [];
      let page = 0;
      while (true) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        const { data } = await this.fetchScoresPage(geography, scoreType, scoreDate, from, to);
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < pageSize) break;
        page += 1;
      }
      return { data: all, total: total || all.length };
    }

    const totalPages = Math.ceil(total / pageSize);
    const pageResults: Array<Array<{
      location_id: string;
      location_name: string;
      score: number;
      grade: string;
      confidence: number;
      confidence_level: string;
    }>> = new Array(totalPages);

    let nextPage = 0;
    const workerCount = Math.max(1, Math.min(concurrency, totalPages));

    const workers = Array.from({ length: workerCount }, async () => {
      while (true) {
        const page = nextPage;
        nextPage += 1;
        if (page >= totalPages) break;
        const from = page * pageSize;
        const to = from + pageSize - 1;
        const { data } = await this.fetchScoresPage(geography, scoreType, scoreDate, from, to);
        pageResults[page] = data || [];
      }
    });

    await Promise.all(workers);

    return {
      data: pageResults.flat(),
      total,
    };
  }

  /**
   * Get all scores for a geography level (no pagination; batches internally).
   * Use sparingly for large geographies like county/zip.
   */
  async getAllScoresForGeographyAll(
    geography: GeographyLevel,
    scoreType: ScoreType,
    periodDate?: string,
    pageSize: number = 1000,
    concurrency: number = 4,
  ): Promise<{
    data: Array<{
      location_id: string;
      location_name: string;
      score: number;
      grade: string;
      confidence: number;
      confidence_level: string;
    }>;
    total: number;
    pageSize: number;
  }> {
    const targetDate = periodDate || (await this.getLatestScoreDate(geography));
    if (!targetDate) {
      return { data: [], total: 0, pageSize };
    }

    const { data, total } = await this.fetchAllScoresBatched(
      geography,
      scoreType,
      targetDate,
      pageSize,
      concurrency,
    );

    return {
      data,
      total: total || data.length,
      pageSize,
    };
  }

  /**
   * Stream pages of scores (sequential) for large exports.
   */
  async *iterateScoresForGeography(
    geography: GeographyLevel,
    scoreType: ScoreType,
    periodDate?: string,
    pageSize: number = 1000,
  ): AsyncGenerator<Array<{
    location_id: string;
    location_name: string;
    score: number;
    grade: string;
    confidence: number;
    confidence_level: string;
  }>> {
    const targetDate = periodDate || (await this.getLatestScoreDate(geography));
    if (!targetDate) return;

    let page = 0;
    while (true) {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      const { data } = await this.fetchScoresPage(geography, scoreType, targetDate, from, to);
      if (!data || data.length === 0) {
        break;
      }
      yield data;
      if (data.length < pageSize) {
        break;
      }
      page += 1;
    }
  }

  /**
   * Search markets by name
   */
  async searchMarkets(
    query: string,
    geography?: GeographyLevel,
    limit: number = 20,
  ): Promise<Array<{ location_id: string; location_name: string; geography: string }>> {
    let queryBuilder = this.supabase
      .from('propertyiq_scores')
      .select('location_id, location_name, geography')
      .ilike('location_name', `%${query}%`)
      .eq('score_type', 'homeready'); // Just need one score type for search

    if (geography) {
      queryBuilder = queryBuilder.eq('geography', geography);
    }

    const { data } = await queryBuilder.limit(limit);

    // Deduplicate by location_id + geography
    const seen = new Set<string>();
    return (data || []).filter(row => {
      const key = `${row.geography}:${row.location_id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // ============================================================================
  // Private: Data Fetching
  // ============================================================================

  private async getLatestDate(geography: GeographyLevel): Promise<string | null> {
    const table = this.getRealtorTable(geography);

    const { data } = await this.supabase
      .from(table)
      .select('period_date')
      .order('period_date', { ascending: false })
      .limit(1);

    return data?.[0]?.period_date || null;
  }

  private async getLatestScoreDate(geography: GeographyLevel): Promise<string | null> {
    const { data } = await this.supabase
      .from('propertyiq_scores')
      .select('score_date')
      .eq('geography', geography)
      .order('score_date', { ascending: false })
      .limit(1);

    return data?.[0]?.score_date || null;
  }

  private getRealtorTable(geography: GeographyLevel): string {
    switch (geography) {
      case 'metro': return 'realtor_metro';
      case 'county': return 'realtor_county';
      case 'zip': return 'realtor_zip';
      default: return 'realtor_metro';
    }
  }

  private getIdColumn(geography: GeographyLevel): string {
    switch (geography) {
      case 'metro': return 'cbsa_code';
      case 'county': return 'county_fips';
      case 'zip': return 'postal_code';
      default: return 'cbsa_code';
    }
  }

  private getNameColumn(geography: GeographyLevel): string {
    switch (geography) {
      case 'metro': return 'cbsa_title';
      case 'county': return 'county_name';
      case 'zip': return 'zip_name';
      default: return 'cbsa_title';
    }
  }

  /**
   * Fetch all metrics for all locations at a geography level
   */
  private async fetchAllMetrics(
    geography: GeographyLevel,
    periodDate: string,
  ): Promise<LocationMetrics[]> {
    const table = this.getRealtorTable(geography);
    const idCol = this.getIdColumn(geography);
    const nameCol = this.getNameColumn(geography);

    // Fetch Realtor data (paginated to avoid Supabase 1000 row limit)
    const pageSize = 1000;
    const realtorData: Array<Record<string, any>> = [];
    let page = 0;
    while (true) {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      const { data, error } = await this.supabase
        .from(table)
        .select(`${idCol}, ${nameCol}, hotness_score, demand_score, supply_score, pending_ratio, price_reduced_share, median_days_on_market, active_listing_count_yy, price_reduced_count_yy, median_listing_price`)
        .eq('period_date', periodDate)
        .order(idCol, { ascending: true })
        .range(from, to);

      if (error) {
        throw new Error(`Failed to fetch realtor data: ${error.message}`);
      }
      if (!data || data.length === 0) break;
      realtorData.push(...data);
      if (data.length < pageSize) break;
      page += 1;
    }

    if (!realtorData || realtorData.length === 0) return [];

    // Build location metrics map
    const locationsMap = new Map<string, LocationMetrics>();

    for (const row of realtorData) {
      const r = row as Record<string, any>;
      const locationId = r[idCol];
      locationsMap.set(locationId, {
        location_id: locationId,
        location_name: r[nameCol] || locationId,
        median_price: r.median_listing_price,
        hotness_score: r.hotness_score,
        demand_score: r.demand_score,
        supply_score: r.supply_score,
        pending_ratio: r.pending_ratio,
        price_reduced_share: r.price_reduced_share,
        median_days_on_market: r.median_days_on_market,
        active_listing_count_yy: r.active_listing_count_yy,
        price_reduced_count_yy: r.price_reduced_count_yy,
      });
    }

    // Fetch census/economic data for all geographies
    if (geography === 'metro' || geography === 'county') {
      await this.fetchCensusData(locationsMap, geography, periodDate);
      await this.fetchEconomicData(locationsMap, geography, periodDate);
    } else if (geography === 'zip') {
      await this.backfillFromCounty(locationsMap, periodDate, ['demand_score', 'hotness_score']);
      await this.fetchZipCensusData(locationsMap, periodDate);
    }

    // Fetch calculated metrics (rent_price_ratio, affordability_ratio) for all geographies
    await this.fetchCalculatedMetrics(locationsMap, geography, periodDate);

    return Array.from(locationsMap.values());
  }

  /**
   * Fetch census data (population_yoy, median_gross_rent, homeownership_rate)
   */
  private async fetchCensusData(
    locationsMap: Map<string, LocationMetrics>,
    geography: GeographyLevel,
    periodDate: string,
  ): Promise<void> {
    const table = geography === 'metro' ? 'census_metro' : 'census_county';
    const idCol = geography === 'metro' ? 'cbsa_code' : 'fips_code';

    // Get the year from periodDate for census (annual data)
    const year = new Date(periodDate).getFullYear();

    const pageSize = 1000;
    let page = 0;
    while (true) {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      const { data, error } = await this.supabase
        .from(table)
        .select(`${idCol}, population_yoy, median_gross_rent, homeownership_rate`)
        .eq('year', year)
        .order(idCol, { ascending: true })
        .range(from, to);

      if (error) {
        throw new Error(`Failed to fetch census data: ${error.message}`);
      }
      if (!data || data.length === 0) break;
      for (const row of data) {
        const location = locationsMap.get(row[idCol]);
        if (location) {
          location.population_yoy = row.population_yoy;
          location.median_gross_rent = row.median_gross_rent;
          location.homeownership_rate = row.homeownership_rate;
        }
      }
      if (data.length < pageSize) break;
      page += 1;
    }
  }

  /**
   * Fetch economic data (unemployment_rate_yoy)
   */
  private async fetchEconomicData(
    locationsMap: Map<string, LocationMetrics>,
    geography: GeographyLevel,
    periodDate: string,
  ): Promise<void> {
    const table = geography === 'metro' ? 'economic_metro' : 'economic_county';
    const idCol = geography === 'metro' ? 'cbsa_code' : 'fips_code';

    const pageSize = 1000;
    let page = 0;
    while (true) {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      const { data, error } = await this.supabase
        .from(table)
        .select(`${idCol}, unemployment_rate_yoy`)
        .eq('period_date', periodDate)
        .order(idCol, { ascending: true })
        .range(from, to);

      if (error) {
        throw new Error(`Failed to fetch economic data: ${error.message}`);
      }
      if (!data || data.length === 0) break;
      for (const row of data) {
        const location = locationsMap.get(row[idCol]);
        if (location) {
          location.unemployment_rate_yoy = row.unemployment_rate_yoy;
        }
      }
      if (data.length < pageSize) break;
      page += 1;
    }
  }

  /**
   * Fetch census data for ZIP geography from census_zip table
   * Provides population_yoy, median_gross_rent, homeownership_rate
   */
  private async fetchZipCensusData(
    locationsMap: Map<string, LocationMetrics>,
    periodDate: string,
  ): Promise<void> {
    const year = new Date(periodDate).getFullYear();

    const pageSize = 1000;
    let page = 0;
    while (true) {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      const { data, error } = await this.supabase
        .from('census_zip')
        .select('zcta, population_yoy, median_gross_rent, homeownership_rate, median_home_value, median_household_income')
        .eq('year', year)
        .order('zcta', { ascending: true })
        .range(from, to);

      if (error) {
        throw new Error(`Failed to fetch ZIP census data: ${error.message}`);
      }
      if (!data || data.length === 0) break;
      for (const row of data) {
        const location = locationsMap.get(row.zcta);
        if (location) {
          if (row.population_yoy != null) location.population_yoy = row.population_yoy;
          if (row.median_gross_rent != null) location.median_gross_rent = row.median_gross_rent;
          if (row.homeownership_rate != null) location.homeownership_rate = row.homeownership_rate;
          // Use census median_home_value as fallback for median_price if not set from Realtor
          if (location.median_price == null && row.median_home_value != null) {
            location.median_price = row.median_home_value;
          }
        }
      }
      if (data.length < pageSize) break;
      page += 1;
    }
  }

  /**
   * Fetch calculated metrics (affordability_ratio, rent_price_ratio)
   * Maps from DB column rent_to_price_ratio → LocationMetrics.rent_price_ratio
   * Computes affordability_ratio from census data already on the location
   */
  private async fetchCalculatedMetrics(
    locationsMap: Map<string, LocationMetrics>,
    geography: GeographyLevel,
    periodDate: string,
  ): Promise<void> {
    // calculated_metrics uses end-of-month dates for rent_to_price_ratio,
    // but scoring uses first-of-month dates. Try both: exact match first,
    // then fall back to end of previous month.
    const endOfPrevMonth = new Date(periodDate);
    endOfPrevMonth.setDate(endOfPrevMonth.getDate() - 1);
    const fallbackDate = endOfPrevMonth.toISOString().split('T')[0];

    const datesToTry = [periodDate, fallbackDate];

    for (const dateToQuery of datesToTry) {
      let foundAny = false;
      const pageSize = 1000;
      let page = 0;
      while (true) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        const { data, error } = await this.supabase
          .from('calculated_metrics')
          .select('geography_id, rent_to_price_ratio')
          .eq('geography_type', geography)
          .eq('period_date', dateToQuery)
          .not('rent_to_price_ratio', 'is', null)
          .order('geography_id', { ascending: true })
          .range(from, to);

        if (error) {
          throw new Error(`Failed to fetch calculated metrics: ${error.message}`);
        }
        if (!data || data.length === 0) break;
        foundAny = true;
        for (const row of data) {
          const location = locationsMap.get(row.geography_id);
          if (location && row.rent_to_price_ratio != null) {
            location.rent_price_ratio = row.rent_to_price_ratio;
          }
        }
        if (data.length < pageSize) break;
        page += 1;
      }
      // If we found data with this date, no need to try fallback
      if (foundAny) break;
    }

    // Compute affordability_ratio from census data already loaded on locations
    // affordability_ratio = median_price / median_gross_rent / 12 (price-to-annual-rent)
    // Higher = less affordable relative to rents = potentially overvalued
    // For scoring formulas, direction=1 means higher ratio → higher score
    for (const location of locationsMap.values()) {
      if (location.median_price != null && location.median_gross_rent != null && location.median_gross_rent > 0) {
        location.affordability_ratio = location.median_price / (location.median_gross_rent * 12);
      }
    }
  }

  /**
   * For ZIP codes, inherit census data from parent county
   */
  private async inheritCountyData(locations: LocationMetrics[]): Promise<void> {
    // Get ZIP to county mapping
    const zipCodes = locations.map(l => l.location_id);

    // Query zillow_zip for county_fips
    const { data: zipMapping } = await this.supabase
      .from('zillow_zip')
      .select('zip_code, county_fips')
      .in('zip_code', zipCodes);

    if (!zipMapping) return;

    // Build ZIP to county map
    const zipToCounty = new Map<string, string>();
    for (const row of zipMapping) {
      if (row.county_fips) {
        zipToCounty.set(row.zip_code, row.county_fips);
      }
    }

    // Get unique county FIPS codes
    const countyFips = [...new Set(zipToCounty.values())];

    // Fetch county census data
    const year = new Date().getFullYear();
    const { data: countyData } = await this.supabase
      .from('census_county')
      .select('fips_code, population_yoy')
      .eq('year', year)
      .in('fips_code', countyFips);

    // Fetch county economic data
    const { data: economicData } = await this.supabase
      .from('economic_county')
      .select('fips_code, unemployment_rate_yoy')
      .in('fips_code', countyFips);

    // Build county data maps
    const countyPopulation = new Map<string, number>();
    const countyUnemployment = new Map<string, number>();

    if (countyData) {
      for (const row of countyData) {
        if (row.population_yoy != null) {
          countyPopulation.set(row.fips_code, row.population_yoy);
        }
      }
    }

    if (economicData) {
      for (const row of economicData) {
        if (row.unemployment_rate_yoy != null) {
          countyUnemployment.set(row.fips_code, row.unemployment_rate_yoy);
        }
      }
    }

    // Apply inheritance to ZIP locations
    for (const location of locations) {
      const countyFips = zipToCounty.get(location.location_id);
      if (!countyFips) continue;

      const inherited: string[] = [];

      if (location.population_yoy == null && countyPopulation.has(countyFips)) {
        location.population_yoy = countyPopulation.get(countyFips);
        inherited.push('population_yoy');
      }

      if (location.unemployment_rate_yoy == null && countyUnemployment.has(countyFips)) {
        location.unemployment_rate_yoy = countyUnemployment.get(countyFips);
        inherited.push('unemployment_rate_yoy');
      }

      if (inherited.length > 0) {
        location._inherited = [...(location._inherited || []), ...inherited];
      }
    }
  }

  /**
   * Backfill missing ZIP metrics from parent county Realtor data.
   * For ZIPs missing demand_score/hotness_score, looks up the parent county
   * via geography_crosswalk and copies the county's values.
   */
  private async backfillFromCounty(
    locationsMap: Map<string, LocationMetrics>,
    periodDate: string,
    metricsToInherit: string[],
  ): Promise<void> {
    // 1. Find ZIPs missing any of the metrics
    const missingZips: string[] = [];
    for (const [zipId, location] of locationsMap) {
      for (const metric of metricsToInherit) {
        if ((location as any)[metric] == null) {
          missingZips.push(zipId);
          break;
        }
      }
    }

    if (missingZips.length === 0) return;

    // 2. Bulk-fetch ZIP→county mappings
    const zipToCounty = new Map<string, string>();
    const pageSize = 1000;
    for (let i = 0; i < missingZips.length; i += pageSize) {
      const batch = missingZips.slice(i, i + pageSize);
      const from = 0;
      const to = batch.length - 1;
      const { data, error } = await this.supabase
        .from('geography_crosswalk')
        .select('zip_code, county_fips')
        .in('zip_code', batch)
        .order('zip_code', { ascending: true })
        .range(from, to);

      if (error) {
        console.warn(`Failed to fetch geography_crosswalk: ${error.message}`);
        return;
      }
      if (data) {
        for (const row of data) {
          if (row.county_fips) {
            zipToCounty.set(row.zip_code, row.county_fips);
          }
        }
      }
    }

    if (zipToCounty.size === 0) return;

    // 3. Get unique county FIPS codes and fetch their Realtor data
    const uniqueCounties = [...new Set(zipToCounty.values())];
    const countyMetrics = new Map<string, Record<string, number | null>>();

    for (let i = 0; i < uniqueCounties.length; i += pageSize) {
      const batch = uniqueCounties.slice(i, i + pageSize);
      const selectCols = ['county_fips', ...metricsToInherit].join(', ');
      const from = 0;
      const to = batch.length - 1;
      const { data, error } = await this.supabase
        .from('realtor_county')
        .select(selectCols)
        .eq('period_date', periodDate)
        .in('county_fips', batch)
        .order('county_fips', { ascending: true })
        .range(from, to);

      if (error) {
        console.warn(`Failed to fetch county Realtor data: ${error.message}`);
        return;
      }
      if (data) {
        for (const row of data as any[]) {
          const values: Record<string, number | null> = {};
          for (const metric of metricsToInherit) {
            values[metric] = row[metric] ?? null;
          }
          countyMetrics.set(row.county_fips, values);
        }
      }
    }

    // 4. Backfill missing ZIP values from parent county
    for (const [zipId, countyFips] of zipToCounty) {
      const location = locationsMap.get(zipId);
      const county = countyMetrics.get(countyFips);
      if (!location || !county) continue;

      for (const metric of metricsToInherit) {
        if ((location as any)[metric] == null && county[metric] != null) {
          (location as any)[metric] = county[metric];
          if (!location._inherited) location._inherited = [];
          location._inherited.push(metric);
        }
      }
    }
  }

  // ============================================================================
  // Private: Z-Score Calculation
  // ============================================================================

  /**
   * Get all metric names used across all formulas for a geography
   */
  private getAllMetricNames(geography: GeographyLevel): string[] {
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
   * Calculate z-scores for all metrics across all locations
   */
  private calculateZScores(
    locations: LocationMetrics[],
    metricNames: string[],
  ): ZScoreMap {
    const zScores: ZScoreMap = {};

    // Initialize zScores for each location
    for (const location of locations) {
      zScores[location.location_id] = {};
    }

    // Calculate z-scores for each metric
    for (const metricName of metricNames) {
      // Get all non-null values for this metric
      const values: number[] = [];
      for (const location of locations) {
        const value = (location as any)[metricName];
        if (value !== null && value !== undefined && !isNaN(value)) {
          values.push(value);
        }
      }

      if (values.length < 2) continue; // Need at least 2 values for meaningful z-score

      // Calculate mean and standard deviation
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
      const std = Math.sqrt(variance);

      if (std === 0) continue; // Skip if no variance

      // Calculate z-score for each location
      for (const location of locations) {
        const value = (location as any)[metricName];
        if (value !== null && value !== undefined && !isNaN(value)) {
          zScores[location.location_id][metricName] = (value - mean) / std;
        }
      }
    }

    return zScores;
  }

  // ============================================================================
  // Private: Score Calculation
  // ============================================================================

  /**
   * Apply formula weights to z-scores
   */
  private applyFormula(
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
          // raw_score += direction × weight × z_score
          rawScore += metricDef.direction * metricDef.weight * zScore;
          totalWeight += metricDef.weight;
        }
      }

      // Normalize by total weight if we have partial data
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
   *
   * Produces a uniform distribution by construction (no outlier sensitivity).
   */
  private normalizeScores(rawScores: RawScoreResult[]): number[] {
    if (rawScores.length === 0) return [];
    if (rawScores.length === 1) return [50];

    // Build sorted index array (ascending by rawScore)
    const indexed = rawScores.map((r, i) => ({ raw: r.rawScore, idx: i }));
    indexed.sort((a, b) => a.raw - b.raw);

    const result = new Array<number>(rawScores.length);
    const n = rawScores.length;

    // Handle ties: assign average rank to tied values
    let i = 0;
    while (i < n) {
      let j = i;
      // Find the end of the tie group
      while (j < n && indexed[j].raw === indexed[i].raw) {
        j++;
      }
      // Average percentile for this tie group
      const avgPercentile = ((i + j - 1) / 2 / (n - 1)) * 100;
      const rounded = Math.round(avgPercentile * 10) / 10;
      for (let k = i; k < j; k++) {
        result[indexed[k].idx] = rounded;
      }
      i = j;
    }

    return result;
  }

  // ============================================================================
  // Private: Component Breakdown
  // ============================================================================

  /**
   * Calculate per-component score breakdowns for a single location.
   *
   * Groups the location's z-scores by component (using COMPONENT_GROUPS),
   * computes a weighted average z-score per component using the metric
   * weights from FORMULA_WEIGHTS, then normalizes each component score
   * to the 0-100 range using a z-score → percentile mapping.
   *
   * @param scoreType - Which score to break down
   * @param geography - Geography level (affects which metrics and components exist)
   * @param locationZScores - Map of metric_name → z-score for this location
   * @param rawValues - Map of metric_name → raw value for this location
   * @returns Array of component breakdowns, one per non-empty component
   */
  private calculateComponentBreakdown(
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
      // Skip empty component groups (e.g., growth_potential at ZIP level)
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
          // Same formula as applyFormula: direction * weight * z_score
          weightedZScoreSum += metricDef.direction * metricDef.weight * zScore;
          totalWeight += metricDef.weight;
        }
      }

      // Normalize the weighted sum by the component's total weight
      // so the result is comparable across components regardless of how
      // many metrics each component has.
      const normalizedZScore = totalWeight > 0
        ? weightedZScoreSum / totalWeight
        : 0;

      // Convert z-score to 0-100 scale using CDF approximation.
      // A z-score of 0 maps to 50, +2 maps to ~97.7, -2 maps to ~2.3.
      // This produces a distribution that feels natural: most scores
      // cluster near 50, with tails reaching toward 0 and 100.
      const componentScore = this.zScoreToPercentile(normalizedZScore);

      // Determine the component's weight in the overall score:
      // sum of the individual metric weights in this component
      const componentWeight = metricNames.reduce((sum, m) => {
        return sum + (formula[m]?.weight ?? 0);
      }, 0);

      const status = this.scoreToComponentStatus(componentScore);

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
   * Convert a z-score to a 0-100 percentile using the standard normal CDF.
   * Uses a rational approximation (Abramowitz & Stegun) for speed.
   *
   * Examples:
   *   z = -3  → ~0.1
   *   z = -2  → ~2.3
   *   z = -1  → ~15.9
   *   z =  0  → 50.0
   *   z =  1  → ~84.1
   *   z =  2  → ~97.7
   *   z =  3  → ~99.9
   */
  private zScoreToPercentile(z: number): number {
    // Clamp to [-4, 4] to avoid extreme values
    const clamped = Math.max(-4, Math.min(4, z));

    // Approximation of the standard normal CDF (Abramowitz & Stegun 26.2.17)
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
    const score = Math.round(cdf * 1000) / 10; // 0-100 with 1 decimal

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Map a component score (0-100) to a human-readable status label.
   *
   * Thresholds are chosen to produce a reasonable distribution:
   *   excellent: top ~20% (80+)
   *   strong:    next ~15% (65-79)
   *   moderate:  middle ~15% (50-64)
   *   watch:     next ~15% (35-49)
   *   concern:   bottom ~35% (<35)
   */
  private scoreToComponentStatus(score: number): ComponentStatus {
    if (score >= 80) return 'excellent';
    if (score >= 65) return 'strong';
    if (score >= 50) return 'moderate';
    if (score >= 35) return 'watch';
    return 'concern';
  }

  // ============================================================================
  // Private: Confidence Calculation
  // ============================================================================

  /**
   * Calculate 4-factor confidence score
   */
  private calculateConfidence(
    location: LocationMetrics,
    geography: GeographyLevel,
    scoreType: ScoreType,
  ): { confidence: number; level: ConfidenceLevel } {
    const formula = FORMULA_WEIGHTS[geography][scoreType];
    const metricNames = Object.keys(formula);

    // Factor 1: Data Completeness (30%)
    const availableMetrics = metricNames.filter(
      m => (location as any)[m] !== null && (location as any)[m] !== undefined,
    ).length;
    let completeness = (availableMetrics / metricNames.length) * 100;

    // Discount for inherited metrics (5pp per inherited metric)
    const inheritedCount = location._inherited
      ? location._inherited.filter(m => metricNames.includes(m)).length
      : 0;
    completeness = Math.max(0, completeness - inheritedCount * 5);

    // Factor 2: Model Strength (40%)
    // correlation × 125, capped at 100
    const correlation = MODEL_CORRELATIONS[geography][scoreType];
    const modelStrength = Math.min(correlation * 125, 100);

    // Factor 3: Sample Size (15%)
    const sampleSizeScore = SAMPLE_SIZE_SCORES[geography];

    // Factor 4: Stability (15%)
    // 80 if has hotness_score, else 60
    const stability = location.hotness_score != null ? 80 : 60;

    // Weighted average
    const confidence =
      completeness * 0.30 +
      modelStrength * 0.40 +
      sampleSizeScore * 0.15 +
      stability * 0.15;

    const level = getConfidenceLevel(confidence);

    return {
      confidence: Math.round(confidence * 10) / 10,
      level,
    };
  }

  // ============================================================================
  // Private: Database Operations
  // ============================================================================

  /**
   * Save score to database
   */
  private async saveScore(result: ScoreResult, scoreDate: string): Promise<void> {
    const rows = this.buildScoreRows([result], scoreDate);
    const ok = await this.upsertScoresWithRetry(rows);
    if (!ok) {
      throw new Error(`Failed to save score for ${result.location_id}`);
    }
  }

  private buildScoreRows(results: ScoreResult[], scoreDate: string): Array<Record<string, any>> {
    const rows: Array<Record<string, any>> = [];
    const createdAt = new Date().toISOString();
    for (const result of results) {
      for (const scoreType of ['homeready', 'investoredge', 'markethealth'] as ScoreType[]) {
        const scoreData = result.scores[scoreType];
        rows.push({
          geography: result.geography,
          location_id: result.location_id,
          location_name: result.location_name,
          score_type: scoreType,
          score: scoreData.score,
          grade: scoreData.grade,
          confidence: scoreData.confidence,
          confidence_level: scoreData.confidence_level,
          median_price: result.median_price,
          score_date: scoreDate,
          created_at: createdAt,
          z_scores: result.z_scores || null,
        });
      }
    }
    return rows;
  }

  private async upsertScoresWithRetry(rows: Array<Record<string, any>>): Promise<boolean> {
    const maxAttempts = 4;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const { error } = await this.supabase
        .from('propertyiq_scores')
        .upsert(rows, { onConflict: 'geography,location_id,score_type,score_date' });

      if (!error) return true;

      const delayMs = Math.min(15000, 500 * Math.pow(2, attempt - 1));
      console.error(`Error saving score batch (attempt ${attempt}/${maxAttempts}):`, error);
      if (attempt < maxAttempts) {
        await this.sleep(delayMs + Math.floor(Math.random() * 250));
      }
    }
    return false;
  }

  private async saveScoresBatch(
    results: ScoreResult[],
    scoreDate: string,
  ): Promise<{ calculated: number; errors: number }> {
    const batchSize = 200; // locations per batch (600 rows)
    let calculated = 0;
    let errors = 0;

    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize);
      const rows = this.buildScoreRows(batch, scoreDate);
      const ok = await this.upsertScoresWithRetry(rows);
      if (ok) {
        calculated += batch.length;
      } else {
        errors += batch.length;
      }

      // Small pause to reduce socket churn during huge backfills
      await this.sleep(50);
    }

    return { calculated, errors };
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ============================================================================
  // Debug Methods
  // ============================================================================

  async debugGetLatestDate(geography: GeographyLevel): Promise<string | null> {
    return this.getLatestDate(geography);
  }

  async debugGetMetricStats(
    geography: GeographyLevel,
    metricName: string,
    periodDate?: string,
  ): Promise<{ count: number; min: number; max: number; mean: number; std: number } | null> {
    const targetDate = periodDate || (await this.getLatestDate(geography));
    if (!targetDate) return null;

    const locations = await this.fetchAllMetrics(geography, targetDate);
    const values = locations
      .map(l => (l as any)[metricName])
      .filter(v => v !== null && v !== undefined && !isNaN(v));

    if (values.length === 0) return null;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const std = Math.sqrt(variance);

    return {
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      mean: Math.round(mean * 100) / 100,
      std: Math.round(std * 100) / 100,
    };
  }

  // ============================================================================
  // Distribution Methods
  // ============================================================================

  /**
   * Get score distribution for a geography and score type.
   * Returns histogram buckets (0-10, 10-20, ..., 90-100) with counts.
   */
  async getScoreDistribution(
    geography: GeographyLevel,
    scoreType: ScoreType,
    periodDate?: string,
  ): Promise<{
    geography: GeographyLevel;
    score_type: ScoreType;
    score_date: string;
    total_count: number;
    distribution: Array<{
      bucket: string;
      min: number;
      max: number;
      count: number;
      percentage: number;
    }>;
    statistics: {
      mean: number;
      median: number;
      std_dev: number;
      min: number;
      max: number;
    };
    grade_distribution: Array<{
      grade: string;
      count: number;
      percentage: number;
    }>;
  }> {
    const targetDate = periodDate || (await this.getLatestScoreDate(geography));
    if (!targetDate) {
      return {
        geography,
        score_type: scoreType,
        score_date: '',
        total_count: 0,
        distribution: [],
        statistics: { mean: 0, median: 0, std_dev: 0, min: 0, max: 0 },
        grade_distribution: [],
      };
    }

    // Fetch all scores for this geography and score type
    const allScores: number[] = [];
    const allGrades: string[] = [];
    const pageSize = 1000;
    let page = 0;

    while (true) {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      const { data, error } = await this.supabase
        .from('propertyiq_scores')
        .select('score, grade')
        .eq('geography', geography)
        .eq('score_type', scoreType)
        .eq('score_date', targetDate)
        .range(from, to);

      if (error) {
        throw new Error(`Failed to fetch scores for distribution: ${error.message}`);
      }
      if (!data || data.length === 0) break;

      for (const row of data) {
        if (row.score !== null && row.score !== undefined) {
          allScores.push(row.score);
          allGrades.push(row.grade || 'F');
        }
      }

      if (data.length < pageSize) break;
      page += 1;
    }

    if (allScores.length === 0) {
      return {
        geography,
        score_type: scoreType,
        score_date: targetDate,
        total_count: 0,
        distribution: [],
        statistics: { mean: 0, median: 0, std_dev: 0, min: 0, max: 0 },
        grade_distribution: [],
      };
    }

    // Calculate histogram buckets (0-10, 10-20, ..., 90-100)
    const buckets = [
      { bucket: '0-10', min: 0, max: 10, count: 0 },
      { bucket: '10-20', min: 10, max: 20, count: 0 },
      { bucket: '20-30', min: 20, max: 30, count: 0 },
      { bucket: '30-40', min: 30, max: 40, count: 0 },
      { bucket: '40-50', min: 40, max: 50, count: 0 },
      { bucket: '50-60', min: 50, max: 60, count: 0 },
      { bucket: '60-70', min: 60, max: 70, count: 0 },
      { bucket: '70-80', min: 70, max: 80, count: 0 },
      { bucket: '80-90', min: 80, max: 90, count: 0 },
      { bucket: '90-100', min: 90, max: 100, count: 0 },
    ];

    for (const score of allScores) {
      const bucketIndex = Math.min(Math.floor(score / 10), 9);
      buckets[bucketIndex].count += 1;
    }

    const totalCount = allScores.length;
    const distribution = buckets.map(b => ({
      ...b,
      percentage: Math.round((b.count / totalCount) * 1000) / 10,
    }));

    // Calculate statistics
    const sortedScores = [...allScores].sort((a, b) => a - b);
    const mean = allScores.reduce((a, b) => a + b, 0) / totalCount;
    const median = totalCount % 2 === 0
      ? (sortedScores[totalCount / 2 - 1] + sortedScores[totalCount / 2]) / 2
      : sortedScores[Math.floor(totalCount / 2)];
    const variance = allScores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / totalCount;
    const stdDev = Math.sqrt(variance);

    const statistics = {
      mean: Math.round(mean * 100) / 100,
      median: Math.round(median * 100) / 100,
      std_dev: Math.round(stdDev * 100) / 100,
      min: Math.round(Math.min(...allScores) * 100) / 100,
      max: Math.round(Math.max(...allScores) * 100) / 100,
    };

    // Calculate grade distribution
    const gradeCounts: Record<string, number> = {};
    for (const grade of allGrades) {
      gradeCounts[grade] = (gradeCounts[grade] || 0) + 1;
    }

    // Sort grades in order: A+, A, A-, B+, B, B-, C+, C, C-, D+, D, D-, F
    const gradeOrder = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'];
    const gradeDistribution = gradeOrder
      .filter(g => gradeCounts[g] !== undefined)
      .map(grade => ({
        grade,
        count: gradeCounts[grade],
        percentage: Math.round((gradeCounts[grade] / totalCount) * 1000) / 10,
      }));

    return {
      geography,
      score_type: scoreType,
      score_date: targetDate,
      total_count: totalCount,
      distribution,
      statistics,
      grade_distribution: gradeDistribution,
    };
  }

  /**
   * Get score distribution for all score types at once
   */
  async getAllScoreDistributions(
    geography: GeographyLevel,
    periodDate?: string,
  ): Promise<{
    geography: GeographyLevel;
    score_date: string;
    distributions: {
      homeready: Awaited<ReturnType<ScoringService['getScoreDistribution']>>;
      investoredge: Awaited<ReturnType<ScoringService['getScoreDistribution']>>;
      markethealth: Awaited<ReturnType<ScoringService['getScoreDistribution']>>;
    };
  }> {
    const targetDate = periodDate || (await this.getLatestScoreDate(geography));

    const [homeready, investoredge, markethealth] = await Promise.all([
      this.getScoreDistribution(geography, 'homeready', targetDate || undefined),
      this.getScoreDistribution(geography, 'investoredge', targetDate || undefined),
      this.getScoreDistribution(geography, 'markethealth', targetDate || undefined),
    ]);

    return {
      geography,
      score_date: targetDate || '',
      distributions: {
        homeready,
        investoredge,
        markethealth,
      },
    };
  }
}
