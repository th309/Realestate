/**
 * Score Validation Service
 *
 * Analyzes the predictive accuracy of PropertyIQ scores by comparing
 * historical scores against actual outcomes. Provides:
 *
 * - Quintile analysis: Are high-scored locations outperforming low-scored?
 * - Correlation metrics: Pearson/Spearman correlation between scores and returns
 * - Hit rate: % of high scores that beat benchmark
 * - Excess return analysis: Score vs excess return scatter data
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type { GeographyType, ScoreType } from '../scoring.types';

export interface ValidationSummary {
  totalScores: number;
  scoresWithOutcomes: number;
  avgScore: number;
  avgReturn1y: number;
  avgReturn3y: number;
  avgExcessVsState1y: number;
  avgExcessVsState3y: number;
  correlation1y: number;
  correlation3y: number;
  hitRate1y: number;  // % of scores >70 that beat benchmark
  hitRate3y: number;
  dataRange: {
    startDate: string;
    endDate: string;
  };
}

export interface QuintileData {
  quintile: number;
  label: string;
  scoreMin: number;
  scoreMax: number;
  avgScore: number;
  count: number;
  avgReturn1y: number | null;
  avgReturn3y: number | null;
  avgExcessVsState1y: number | null;
  avgExcessVsState3y: number | null;
  avgExcessVsNational1y: number | null;
  avgExcessVsNational3y: number | null;
}

export interface ScatterPoint {
  geographyId: string;
  geographyName: string;
  scoreDate: string;
  score: number;
  return1y: number | null;
  return3y: number | null;
  excessVsState1y: number | null;
  excessVsState3y: number | null;
}

export interface TimeSeriesAccuracy {
  date: string;
  avgScore: number;
  avgActualReturn: number;
  correlation: number;
  hitRate: number;
  sampleSize: number;
}

export interface GeographyBreakdown {
  geographyType: GeographyType;
  totalScores: number;
  avgCorrelation1y: number;
  avgCorrelation3y: number;
  avgHitRate1y: number;
  avgHitRate3y: number;
  topPerformer: {
    id: string;
    name: string;
    score: number;
    excessReturn: number;
  } | null;
}

@Injectable()
export class ValidationService {
  private readonly logger = new Logger(ValidationService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Get summary of score validation metrics
   */
  async getValidationSummary(
    geographyType?: GeographyType,
    scoreType?: ScoreType,
  ): Promise<ValidationSummary> {
    const client = this.supabase.getClient();

    // Build query
    let query = client
      .from('propertyiq_backtest_outcomes')
      .select('*');

    if (geographyType) {
      query = query.eq('geography_type', geographyType);
    }
    if (scoreType) {
      query = query.eq('score_type', scoreType);
    }

    const { data, error } = await query;

    if (error || !data) {
      this.logger.error(`Error fetching validation data: ${error?.message}`);
      return this.emptyValidationSummary();
    }

    // Filter to records with outcomes
    const withOutcomes = data.filter(
      (d) => d.outcome_1y_value != null || d.outcome_3y_value != null
    );

    if (withOutcomes.length === 0) {
      return this.emptyValidationSummary();
    }

    // Calculate averages
    const scores = withOutcomes.filter((d) => d.score_value != null);
    const avgScore = this.avg(scores.map((d) => d.score_value));

    const with1y = withOutcomes.filter((d) => d.outcome_1y_value != null);
    const with3y = withOutcomes.filter((d) => d.outcome_3y_value != null);

    const avgReturn1y = this.avg(with1y.map((d) => d.outcome_1y_value));
    const avgReturn3y = this.avg(with3y.map((d) => d.outcome_3y_value));

    const withExcess1y = withOutcomes.filter((d) => d.excess_vs_state_1y != null);
    const withExcess3y = withOutcomes.filter((d) => d.excess_vs_state_3y != null);

    const avgExcessVsState1y = this.avg(withExcess1y.map((d) => d.excess_vs_state_1y));
    const avgExcessVsState3y = this.avg(withExcess3y.map((d) => d.excess_vs_state_3y));

    // Calculate correlations
    const correlation1y = this.calculateCorrelation(
      with1y.map((d) => d.score_value),
      with1y.map((d) => d.outcome_1y_value)
    );
    const correlation3y = this.calculateCorrelation(
      with3y.map((d) => d.score_value),
      with3y.map((d) => d.outcome_3y_value)
    );

    // Calculate hit rates (scores > 70 that beat benchmark)
    const highScores1y = withExcess1y.filter((d) => d.score_value >= 70);
    const highScores3y = withExcess3y.filter((d) => d.score_value >= 70);

    const hitRate1y = highScores1y.length > 0
      ? highScores1y.filter((d) => d.excess_vs_state_1y > 0).length / highScores1y.length
      : 0;
    const hitRate3y = highScores3y.length > 0
      ? highScores3y.filter((d) => d.excess_vs_state_3y > 0).length / highScores3y.length
      : 0;

    // Get date range
    const dates = withOutcomes.map((d) => d.score_date).sort();

    return {
      totalScores: data.length,
      scoresWithOutcomes: withOutcomes.length,
      avgScore,
      avgReturn1y,
      avgReturn3y,
      avgExcessVsState1y,
      avgExcessVsState3y,
      correlation1y,
      correlation3y,
      hitRate1y,
      hitRate3y,
      dataRange: {
        startDate: dates[0] || '',
        endDate: dates[dates.length - 1] || '',
      },
    };
  }

  /**
   * Get quintile analysis - scores grouped into 5 buckets
   */
  async getQuintileAnalysis(
    geographyType?: GeographyType,
    scoreType?: ScoreType,
    horizon: '1y' | '3y' = '1y',
  ): Promise<QuintileData[]> {
    const client = this.supabase.getClient();

    // Use server-side RPC for efficient aggregation (avoids Supabase row limits)
    const { data: rpcData, error: rpcError } = await client.rpc(
      'get_quintile_performance',
      {
        p_score_type: scoreType || 'homeready',
        p_geography_type: geographyType || 'metro',
        p_horizon: horizon,
      },
    );

    if (!rpcError && rpcData && rpcData.length > 0) {
      return rpcData.map((row: any) => ({
        quintile: row.quintile,
        label: row.label,
        scoreMin: parseFloat(row.score_min),
        scoreMax: parseFloat(row.score_max),
        avgScore: parseFloat(row.avg_score),
        count: row.sample_count,
        avgReturn1y: row.avg_return_1y != null ? parseFloat(row.avg_return_1y) : null,
        avgReturn3y: row.avg_return_3y != null ? parseFloat(row.avg_return_3y) : null,
        avgExcessVsState1y: row.avg_excess_vs_state_1y != null ? parseFloat(row.avg_excess_vs_state_1y) : null,
        avgExcessVsState3y: row.avg_excess_vs_state_3y != null ? parseFloat(row.avg_excess_vs_state_3y) : null,
        avgExcessVsNational1y: row.avg_excess_vs_national_1y != null ? parseFloat(row.avg_excess_vs_national_1y) : null,
        avgExcessVsNational3y: row.avg_excess_vs_national_3y != null ? parseFloat(row.avg_excess_vs_national_3y) : null,
      }));
    }

    // Fallback: client-side query if RPC fails
    let query = client
      .from('propertyiq_backtest_outcomes')
      .select('score_value,outcome_1y_value,outcome_3y_value,rent_return_1y,rent_return_3y_cagr,excess_vs_state_1y,excess_vs_state_3y,excess_vs_national_1y,excess_vs_national_3y')
      .not('score_value', 'is', null)
      .limit(50000);

    if (geographyType) {
      query = query.eq('geography_type', geographyType);
    }
    if (scoreType) {
      query = query.eq('score_type', scoreType);
    }

    const excessCol = horizon === '1y' ? 'excess_vs_state_1y' : 'excess_vs_state_3y';
    query = query.not(excessCol, 'is', null);

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
      return [];
    }

    const sorted = [...data].sort((a, b) => a.score_value - b.score_value);
    const quintileSize = Math.ceil(sorted.length / 5);

    const quintiles: QuintileData[] = [];
    const labels = ['Bottom 20%', 'Lower 20%', 'Middle 20%', 'Upper 20%', 'Top 20%'];

    for (let i = 0; i < 5; i++) {
      const start = i * quintileSize;
      const end = Math.min((i + 1) * quintileSize, sorted.length);
      const quintileSlice = sorted.slice(start, end);

      if (quintileSlice.length === 0) continue;

      const scores = quintileSlice.map((d) => d.score_value);

      quintiles.push({
        quintile: i + 1,
        label: labels[i],
        scoreMin: Math.min(...scores),
        scoreMax: Math.max(...scores),
        avgScore: this.avg(scores),
        count: quintileSlice.length,
        avgReturn1y: this.avg(quintileSlice.map((d) => d.outcome_1y_value)),
        avgReturn3y: this.avg(quintileSlice.map((d) => d.outcome_3y_value)),
        avgExcessVsState1y: this.avg(quintileSlice.map((d) => d.excess_vs_state_1y)),
        avgExcessVsState3y: this.avg(quintileSlice.map((d) => d.excess_vs_state_3y)),
        avgExcessVsNational1y: this.avg(quintileSlice.map((d) => d.excess_vs_national_1y)),
        avgExcessVsNational3y: this.avg(quintileSlice.map((d) => d.excess_vs_national_3y)),
      });
    }

    return quintiles;
  }

  /**
   * Get scatter plot data (score vs return)
   */
  async getScatterData(
    geographyType?: GeographyType,
    scoreType?: ScoreType,
    limit: number = 500,
  ): Promise<ScatterPoint[]> {
    const client = this.supabase.getClient();

    // Build query — include geography_type so we know which name table to use
    let query = client
      .from('propertyiq_backtest_outcomes')
      .select('geography_id, geography_type, score_date, score_value, outcome_1y_value, outcome_3y_value, excess_vs_state_1y, excess_vs_state_3y')
      .not('score_value', 'is', null)
      .limit(limit);

    if (geographyType) {
      query = query.eq('geography_type', geographyType);
    }
    if (scoreType) {
      query = query.eq('score_type', scoreType);
    }

    const { data, error } = await query;

    if (error || !data) {
      return [];
    }

    // Batch-lookup geography names
    const nameMap = await this.resolveGeographyNames(
      data.map((d) => ({ id: d.geography_id, type: d.geography_type })),
    );

    const points: ScatterPoint[] = [];
    for (const d of data) {
      points.push({
        geographyId: d.geography_id,
        geographyName: nameMap.get(d.geography_id) || d.geography_id,
        scoreDate: d.score_date,
        score: d.score_value,
        return1y: d.outcome_1y_value,
        return3y: d.outcome_3y_value,
        excessVsState1y: d.excess_vs_state_1y,
        excessVsState3y: d.excess_vs_state_3y,
      });
    }

    return points;
  }

  /**
   * Resolve geography IDs to human-readable names.
   * - Metro: cbsa_title from realtor_metro (e.g. "Palm Bay-Melbourne-Titusville, FL")
   * - County: county_name from realtor_county, formatted as "X County, ST"
   * - ZIP: geography_id as-is
   */
  private async resolveGeographyNames(
    geos: { id: string; type: string }[],
  ): Promise<Map<string, string>> {
    const nameMap = new Map<string, string>();
    const client = this.supabase.getClient();

    // Collect unique IDs per type
    const idsByType = new Map<string, Set<string>>();
    for (const g of geos) {
      if (!idsByType.has(g.type)) idsByType.set(g.type, new Set());
      idsByType.get(g.type)!.add(g.id);
    }

    // Batch lookup from propertyiq_scores (one row per location_id per score_date,
    // but we only need distinct location_id + location_name)
    for (const [geoType, ids] of idsByType) {
      if (geoType === 'zip') continue; // ZIPs stay as-is

      const idArray = [...ids];
      // Process in batches of 500 to stay within Supabase .in() limits
      for (let i = 0; i < idArray.length; i += 500) {
        const batch = idArray.slice(i, i + 500);
        const { data } = await client
          .from('propertyiq_scores')
          .select('location_id, location_name')
          .eq('geography', geoType)
          .in('location_id', batch)
          .limit(5000);

        if (data) {
          for (const row of data) {
            if (nameMap.has(row.location_id) || !row.location_name) continue;

            if (geoType === 'county') {
              // location_name stored as "autauga, al" — format to "Autauga County, AL"
              const parts = row.location_name.split(', ');
              if (parts.length === 2) {
                const county = parts[0]
                  .split(' ')
                  .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
                  .join(' ');
                const state = parts[1].toUpperCase();
                nameMap.set(row.location_id, `${county} County, ${state}`);
              } else {
                nameMap.set(row.location_id, row.location_name);
              }
            } else {
              // Metro names already have proper format (e.g. "Aberdeen, SD")
              nameMap.set(row.location_id, row.location_name);
            }
          }
        }
      }
    }

    return nameMap;
  }

  /**
   * Get time series accuracy - how correlation changes over time
   */
  async getTimeSeriesAccuracy(
    geographyType?: GeographyType,
    scoreType?: ScoreType,
  ): Promise<TimeSeriesAccuracy[]> {
    const client = this.supabase.getClient();

    // Build query
    let query = client
      .from('propertyiq_backtest_outcomes')
      .select('score_date, score_value, outcome_1y_value, excess_vs_state_1y')
      .not('score_value', 'is', null)
      .not('outcome_1y_value', 'is', null)
      .order('score_date', { ascending: true });

    if (geographyType) {
      query = query.eq('geography_type', geographyType);
    }
    if (scoreType) {
      query = query.eq('score_type', scoreType);
    }

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
      return [];
    }

    // Group by score_date
    const byDate = new Map<string, typeof data>();
    for (const d of data) {
      const existing = byDate.get(d.score_date) || [];
      existing.push(d);
      byDate.set(d.score_date, existing);
    }

    // Calculate metrics for each date
    const results: TimeSeriesAccuracy[] = [];

    for (const [date, records] of byDate) {
      if (records.length < 10) continue; // Need minimum sample

      const scores = records.map((r) => r.score_value);
      const returns = records.map((r) => r.outcome_1y_value);
      const excesses = records.map((r) => r.excess_vs_state_1y).filter((e) => e != null);

      // High scores (>70) that beat benchmark
      const highScores = records.filter((r) => r.score_value >= 70 && r.excess_vs_state_1y != null);
      const hitRate = highScores.length > 0
        ? highScores.filter((r) => r.excess_vs_state_1y > 0).length / highScores.length
        : 0;

      results.push({
        date,
        avgScore: this.avg(scores),
        avgActualReturn: this.avg(returns),
        correlation: this.calculateCorrelation(scores, returns),
        hitRate,
        sampleSize: records.length,
      });
    }

    return results;
  }

  /**
   * Get breakdown by geography type
   */
  async getGeographyBreakdown(
    scoreType?: ScoreType,
  ): Promise<GeographyBreakdown[]> {
    const geographyTypes: GeographyType[] = ['metro', 'county', 'zip'];
    const results: GeographyBreakdown[] = [];

    for (const geoType of geographyTypes) {
      const summary = await this.getValidationSummary(geoType, scoreType);

      // Get top performer
      const client = this.supabase.getClient();
      let topQuery = client
        .from('propertyiq_backtest_outcomes')
        .select('geography_id, score_value, excess_vs_state_3y')
        .eq('geography_type', geoType)
        .not('score_value', 'is', null)
        .not('excess_vs_state_3y', 'is', null)
        .order('excess_vs_state_3y', { ascending: false })
        .limit(1);

      if (scoreType) {
        topQuery = topQuery.eq('score_type', scoreType);
      }

      const { data: topData } = await topQuery;

      // Resolve top performer name
      let topName = topData?.[0]?.geography_id || '';
      if (topData?.[0]) {
        const nameMap = await this.resolveGeographyNames([
          { id: topData[0].geography_id, type: geoType },
        ]);
        topName = nameMap.get(topData[0].geography_id) || topData[0].geography_id;
      }

      results.push({
        geographyType: geoType,
        totalScores: summary.totalScores,
        avgCorrelation1y: summary.correlation1y,
        avgCorrelation3y: summary.correlation3y,
        avgHitRate1y: summary.hitRate1y,
        avgHitRate3y: summary.hitRate3y,
        topPerformer: topData?.[0]
          ? {
              id: topData[0].geography_id,
              name: topName,
              score: topData[0].score_value,
              excessReturn: topData[0].excess_vs_state_3y,
            }
          : null,
      });
    }

    return results;
  }

  // ========================================================================
  // Private Helper Methods
  // ========================================================================

  private avg(values: (number | null | undefined)[]): number {
    const valid = values.filter((v) => v != null) as number[];
    if (valid.length === 0) return 0;
    return valid.reduce((a, b) => a + b, 0) / valid.length;
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length < 2) return 0;

    // Filter out any pairs with null/undefined
    const pairs = x
      .map((xi, i) => [xi, y[i]] as [number, number])
      .filter(([xi, yi]) => xi != null && yi != null);

    if (pairs.length < 2) return 0;

    const n = pairs.length;
    const sumX = pairs.reduce((a, [xi]) => a + xi, 0);
    const sumY = pairs.reduce((a, [, yi]) => a + yi, 0);
    const sumXY = pairs.reduce((a, [xi, yi]) => a + xi * yi, 0);
    const sumX2 = pairs.reduce((a, [xi]) => a + xi * xi, 0);
    const sumY2 = pairs.reduce((a, [, yi]) => a + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    if (denominator === 0) return 0;
    return numerator / denominator;
  }

  private emptyValidationSummary(): ValidationSummary {
    return {
      totalScores: 0,
      scoresWithOutcomes: 0,
      avgScore: 0,
      avgReturn1y: 0,
      avgReturn3y: 0,
      avgExcessVsState1y: 0,
      avgExcessVsState3y: 0,
      correlation1y: 0,
      correlation3y: 0,
      hitRate1y: 0,
      hitRate3y: 0,
      dataRange: { startDate: '', endDate: '' },
    };
  }
}
