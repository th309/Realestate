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
  SCORE_HISTORY_MONTHS_MAX,
  ScoreHistoryResult,
} from './scoring.types';

// Re-export types for consumers
export type { GeographyType, LocationMetrics, ScoreResult, SingleScoreResult };

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
          };
          allResults.push(result);
        }

        result.scores[scoreType] = { score, grade, confidence, confidence_level: level };
      }
    }

    // 7. Save all scores to database
    let calculated = 0;
    let errors = 0;

    for (const result of allResults) {
      try {
        await this.saveScore(result, targetDate);
        calculated++;
      } catch (err) {
        errors++;
        console.error(`Error saving score for ${result.location_id}:`, err);
      }
    }

    return { calculated, errors, scoreDate: targetDate };
  }

  /**
   * Get scores for a single location.
   * When historyMonths > 0 (max SCORE_HISTORY_MONTHS_MAX), fetches up to 6 months of history,
   * sets trend_change (current - prior period) and attaches history for frontend real-time calculations.
   */
  async getScore(
    locationId: string,
    geography: GeographyLevel,
    periodDate?: string,
    options?: { historyMonths?: number },
  ): Promise<ScoreResult | null> {
    const targetDate = periodDate || (await this.getLatestScoreDate(geography));
    if (!targetDate) return null;

    const result = await this.getScoreForDate(locationId, geography, targetDate);
    if (!result) return null;

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

    for (const row of data) {
      locationName = row.location_name || locationName;
      medianPrice = row.median_price ?? medianPrice;
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
    const targetDate = periodDate || (await this.getLatestDate(geography));
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

    // Fetch Realtor data
    const { data: realtorData } = await this.supabase
      .from(table)
      .select(`${idCol}, ${nameCol}, hotness_score, demand_score, pending_ratio, price_reduced_share, active_listing_count_yy, price_reduced_count_yy, median_listing_price`)
      .eq('period_date', periodDate);

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
        pending_ratio: r.pending_ratio,
        price_reduced_share: r.price_reduced_share,
        active_listing_count_yy: r.active_listing_count_yy,
        price_reduced_count_yy: r.price_reduced_count_yy,
      });
    }

    // For metro and county, also fetch census/economic data
    if (geography === 'metro' || geography === 'county') {
      await this.fetchCensusData(locationsMap, geography, periodDate);
      await this.fetchEconomicData(locationsMap, geography, periodDate);
    }

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

    const { data } = await this.supabase
      .from(table)
      .select(`${idCol}, population_yoy, median_gross_rent, homeownership_rate`)
      .eq('year', year);

    if (data) {
      for (const row of data) {
        const location = locationsMap.get(row[idCol]);
        if (location) {
          location.population_yoy = row.population_yoy;
          location.median_gross_rent = row.median_gross_rent;
          location.homeownership_rate = row.homeownership_rate;
        }
      }
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

    const { data } = await this.supabase
      .from(table)
      .select(`${idCol}, unemployment_rate_yoy`)
      .eq('period_date', periodDate);

    if (data) {
      for (const row of data) {
        const location = locationsMap.get(row[idCol]);
        if (location) {
          location.unemployment_rate_yoy = row.unemployment_rate_yoy;
        }
      }
    }
  }

  /**
   * Fetch calculated metrics (affordability_ratio, rent_price_ratio)
   */
  private async fetchCalculatedMetrics(
    locationsMap: Map<string, LocationMetrics>,
    geography: GeographyLevel,
    periodDate: string,
  ): Promise<void> {
    const { data } = await this.supabase
      .from('calculated_metrics')
      .select('geography_id, affordability_ratio, rent_price_ratio')
      .eq('geography_type', geography)
      .eq('period_date', periodDate);

    if (data) {
      for (const row of data) {
        const location = locationsMap.get(row.geography_id);
        if (location) {
          location.affordability_ratio = row.affordability_ratio;
          location.rent_price_ratio = row.rent_price_ratio;
        }
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
        location._inherited = inherited;
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
   * Normalize raw scores to 0-100 range
   */
  private normalizeScores(rawScores: RawScoreResult[]): number[] {
    if (rawScores.length === 0) return [];

    const scores = rawScores.map(r => r.rawScore);
    const minRaw = Math.min(...scores);
    const maxRaw = Math.max(...scores);

    // Handle edge case where all scores are the same
    if (maxRaw === minRaw) {
      return rawScores.map(() => 50); // All get middle score
    }

    return rawScores.map(r => {
      const normalized = ((r.rawScore - minRaw) / (maxRaw - minRaw)) * 100;
      return Math.round(normalized * 10) / 10; // Round to 1 decimal
    });
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
    const completeness = (availableMetrics / metricNames.length) * 100;

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
    // Insert/update all three score types
    for (const scoreType of ['homeready', 'investoredge', 'markethealth'] as ScoreType[]) {
      const scoreData = result.scores[scoreType];

      const { error } = await this.supabase.from('propertyiq_scores').upsert(
        {
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
          created_at: new Date().toISOString(),
        },
        {
          onConflict: 'geography,location_id,score_type,score_date',
        },
      );

      if (error) {
        console.error(`Error saving score for ${result.location_id}/${scoreType}:`, error);
        throw error;
      }
    }
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
}
