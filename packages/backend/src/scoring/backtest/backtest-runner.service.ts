/**
 * Backtest Runner Service
 *
 * Runs backtests comparing historical scores to actual outcomes.
 * Calculates correlation, error metrics, and statistical significance.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type { ScoreType, GeographyType } from '../scoring.types';
import { v4 as uuidv4 } from 'uuid';

export interface BacktestParams {
  scoreType: ScoreType;
  geographyType: GeographyType;
  formulaVersion: string;
  startDate: string;
  endDate: string;
  outcomeHorizon: '6m' | '1y' | '3y' | '5y';
  componentName?: string;
}

export interface BacktestResult {
  runId: string;
  scoreType: ScoreType;
  componentName: string | null;
  geographyType: GeographyType;
  formulaVersion: string;
  backtestStartDate: string;
  backtestEndDate: string;
  outcomeHorizon: string;
  sampleCount: number;
  geographyCount: number;

  // Correlation metrics
  rSquared: number | null;
  pearsonCorrelation: number | null;
  spearmanCorrelation: number | null;

  // Error metrics
  meanAbsoluteError: number | null;
  rootMeanSquaredError: number | null;
  meanAbsolutePercentageError: number | null;

  // Distribution metrics
  scoreMean: number;
  scoreStdDev: number;
  outcomeMean: number;
  outcomeStdDev: number;

  // Additional metrics
  hitRate: number | null;
  decileSpread: number | null;
}

interface ScoreOutcomePair {
  geographyId: string;
  score: number;
  outcome: number;
}

@Injectable()
export class BacktestRunnerService {
  private readonly logger = new Logger(BacktestRunnerService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Run a backtest for given parameters
   */
  async runBacktest(params: BacktestParams): Promise<BacktestResult> {
    const runId = uuidv4();

    this.logger.log(`Starting backtest ${runId} for ${params.scoreType} ${params.geographyType}`);

    // Get score-outcome pairs
    const pairs = await this.getScoreOutcomePairs(params);

    if (pairs.length < 10) {
      this.logger.warn(`Insufficient data for backtest: ${pairs.length} pairs`);
      return this.createEmptyResult(runId, params);
    }

    // Calculate metrics
    const result = this.calculateMetrics(runId, params, pairs);

    // Save result
    await this.saveResult(result);

    this.logger.log(
      `Backtest ${runId} complete: ${pairs.length} samples, R²=${result.rSquared?.toFixed(4)}`,
    );

    return result;
  }

  /**
   * Run backtests for all geography types
   */
  async runFullBacktest(
    scoreType: ScoreType,
    formulaVersion: string,
    startDate: string,
    endDate: string,
  ): Promise<BacktestResult[]> {
    const results: BacktestResult[] = [];
    const geoTypes: GeographyType[] = ['state', 'metro', 'county', 'zip'];
    const horizons: Array<'6m' | '1y' | '3y' | '5y'> = ['6m', '1y', '3y', '5y'];

    for (const geoType of geoTypes) {
      for (const horizon of horizons) {
        try {
          const result = await this.runBacktest({
            scoreType,
            geographyType: geoType,
            formulaVersion,
            startDate,
            endDate,
            outcomeHorizon: horizon,
          });
          results.push(result);
        } catch (error) {
          this.logger.error(`Error in backtest ${geoType}/${horizon}: ${error}`);
        }
      }
    }

    return results;
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private async getScoreOutcomePairs(params: BacktestParams): Promise<ScoreOutcomePair[]> {
    const client = this.supabase.getClient();

    const outcomeColumn = this.getOutcomeColumn(params.outcomeHorizon);

    const { data, error } = await client
      .from('propertyiq_backtest_outcomes')
      .select(`geography_id, score_value, ${outcomeColumn}`)
      .eq('geography_type', params.geographyType)
      .eq('score_type', params.scoreType)
      .gte('score_date', params.startDate)
      .lte('score_date', params.endDate)
      .not('score_value', 'is', null)
      .not(outcomeColumn, 'is', null);

    if (error || !data) {
      this.logger.error(`Error fetching score-outcome pairs: ${error?.message}`);
      return [];
    }

    return data.map((d) => ({
      geographyId: d.geography_id,
      score: d.score_value as number,
      outcome: d[outcomeColumn] as number,
    }));
  }

  private getOutcomeColumn(horizon: string): string {
    switch (horizon) {
      case '6m':
        return 'outcome_6m_value';
      case '1y':
        return 'outcome_1y_value';
      case '3y':
        return 'outcome_3y_value';
      case '5y':
        return 'outcome_5y_value';
      default:
        return 'outcome_1y_value';
    }
  }

  private calculateMetrics(
    runId: string,
    params: BacktestParams,
    pairs: ScoreOutcomePair[],
  ): BacktestResult {
    const scores = pairs.map((p) => p.score);
    const outcomes = pairs.map((p) => p.outcome);

    // Basic statistics
    const scoreMean = this.mean(scores);
    const scoreStdDev = this.stdDev(scores, scoreMean);
    const outcomeMean = this.mean(outcomes);
    const outcomeStdDev = this.stdDev(outcomes, outcomeMean);

    // Correlation
    const pearsonCorrelation = this.pearsonCorrelation(scores, outcomes, scoreMean, outcomeMean);
    const rSquared = pearsonCorrelation !== null ? pearsonCorrelation * pearsonCorrelation : null;
    const spearmanCorrelation = this.spearmanCorrelation(scores, outcomes);

    // Error metrics
    const mae = this.meanAbsoluteError(scores, outcomes);
    const rmse = this.rootMeanSquaredError(scores, outcomes);
    const mape = this.meanAbsolutePercentageError(scores, outcomes);

    // Hit rate (% of correct direction predictions)
    const hitRate = this.calculateHitRate(pairs, scoreMean, outcomeMean);

    // Decile spread
    const decileSpread = this.calculateDecileSpread(pairs);

    // Unique geographies
    const uniqueGeos = new Set(pairs.map((p) => p.geographyId)).size;

    return {
      runId,
      scoreType: params.scoreType,
      componentName: params.componentName || null,
      geographyType: params.geographyType,
      formulaVersion: params.formulaVersion,
      backtestStartDate: params.startDate,
      backtestEndDate: params.endDate,
      outcomeHorizon: params.outcomeHorizon,
      sampleCount: pairs.length,
      geographyCount: uniqueGeos,
      rSquared,
      pearsonCorrelation,
      spearmanCorrelation,
      meanAbsoluteError: mae,
      rootMeanSquaredError: rmse,
      meanAbsolutePercentageError: mape,
      scoreMean,
      scoreStdDev,
      outcomeMean,
      outcomeStdDev,
      hitRate,
      decileSpread,
    };
  }

  private createEmptyResult(runId: string, params: BacktestParams): BacktestResult {
    return {
      runId,
      scoreType: params.scoreType,
      componentName: params.componentName || null,
      geographyType: params.geographyType,
      formulaVersion: params.formulaVersion,
      backtestStartDate: params.startDate,
      backtestEndDate: params.endDate,
      outcomeHorizon: params.outcomeHorizon,
      sampleCount: 0,
      geographyCount: 0,
      rSquared: null,
      pearsonCorrelation: null,
      spearmanCorrelation: null,
      meanAbsoluteError: null,
      rootMeanSquaredError: null,
      meanAbsolutePercentageError: null,
      scoreMean: 0,
      scoreStdDev: 0,
      outcomeMean: 0,
      outcomeStdDev: 0,
      hitRate: null,
      decileSpread: null,
    };
  }

  private async saveResult(result: BacktestResult): Promise<void> {
    const client = this.supabase.getClient();

    const { error } = await client.from('propertyiq_backtest_results').insert({
      run_id: result.runId,
      score_type: result.scoreType,
      component_name: result.componentName,
      geography_type: result.geographyType,
      formula_version: result.formulaVersion,
      backtest_start_date: result.backtestStartDate,
      backtest_end_date: result.backtestEndDate,
      outcome_horizon: result.outcomeHorizon,
      sample_count: result.sampleCount,
      geography_count: result.geographyCount,
      r_squared: result.rSquared,
      pearson_correlation: result.pearsonCorrelation,
      spearman_correlation: result.spearmanCorrelation,
      mean_absolute_error: result.meanAbsoluteError,
      root_mean_squared_error: result.rootMeanSquaredError,
      mean_absolute_percentage_error: result.meanAbsolutePercentageError,
      score_mean: result.scoreMean,
      score_std_dev: result.scoreStdDev,
      outcome_mean: result.outcomeMean,
      outcome_std_dev: result.outcomeStdDev,
      hit_rate: result.hitRate,
      decile_spread: result.decileSpread,
    });

    if (error) {
      this.logger.error(`Error saving backtest result: ${error.message}`);
    }
  }

  // ========================================================================
  // Statistical Helper Methods
  // ========================================================================

  private mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  private stdDev(values: number[], mean: number): number {
    if (values.length < 2) return 0;
    const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((sum, v) => sum + v, 0) / (values.length - 1));
  }

  private pearsonCorrelation(
    x: number[],
    y: number[],
    xMean: number,
    yMean: number,
  ): number | null {
    if (x.length !== y.length || x.length < 3) return null;

    let sumXY = 0;
    let sumX2 = 0;
    let sumY2 = 0;

    for (let i = 0; i < x.length; i++) {
      const dx = x[i] - xMean;
      const dy = y[i] - yMean;
      sumXY += dx * dy;
      sumX2 += dx * dx;
      sumY2 += dy * dy;
    }

    const denominator = Math.sqrt(sumX2 * sumY2);
    if (denominator === 0) return null;

    return sumXY / denominator;
  }

  private spearmanCorrelation(x: number[], y: number[]): number | null {
    if (x.length !== y.length || x.length < 3) return null;

    // Rank the values
    const xRanks = this.rankValues(x);
    const yRanks = this.rankValues(y);

    // Calculate Pearson correlation on ranks
    const xMean = this.mean(xRanks);
    const yMean = this.mean(yRanks);

    return this.pearsonCorrelation(xRanks, yRanks, xMean, yMean);
  }

  private rankValues(values: number[]): number[] {
    const indexed = values.map((v, i) => ({ value: v, index: i }));
    indexed.sort((a, b) => a.value - b.value);

    const ranks = new Array(values.length);
    for (let i = 0; i < indexed.length; i++) {
      ranks[indexed[i].index] = i + 1;
    }

    return ranks;
  }

  private meanAbsoluteError(predicted: number[], actual: number[]): number | null {
    if (predicted.length !== actual.length || predicted.length === 0) return null;

    const errors = predicted.map((p, i) => Math.abs(p - actual[i]));
    return this.mean(errors);
  }

  private rootMeanSquaredError(predicted: number[], actual: number[]): number | null {
    if (predicted.length !== actual.length || predicted.length === 0) return null;

    const squaredErrors = predicted.map((p, i) => Math.pow(p - actual[i], 2));
    return Math.sqrt(this.mean(squaredErrors));
  }

  private meanAbsolutePercentageError(predicted: number[], actual: number[]): number | null {
    if (predicted.length !== actual.length || predicted.length === 0) return null;

    const validPairs = predicted
      .map((p, i) => ({ p, a: actual[i] }))
      .filter((pair) => pair.a !== 0);

    if (validPairs.length === 0) return null;

    const percentageErrors = validPairs.map((pair) => Math.abs((pair.p - pair.a) / pair.a));
    return this.mean(percentageErrors) * 100;
  }

  private calculateHitRate(
    pairs: ScoreOutcomePair[],
    scoreMean: number,
    outcomeMean: number,
  ): number | null {
    if (pairs.length === 0) return null;

    let hits = 0;
    for (const pair of pairs) {
      const scoreAboveMean = pair.score > scoreMean;
      const outcomeAboveMean = pair.outcome > outcomeMean;

      if (scoreAboveMean === outcomeAboveMean) {
        hits++;
      }
    }

    return hits / pairs.length;
  }

  private calculateDecileSpread(pairs: ScoreOutcomePair[]): number | null {
    if (pairs.length < 10) return null;

    // Sort by score
    const sorted = [...pairs].sort((a, b) => a.score - b.score);

    // Get top and bottom decile
    const decileSize = Math.floor(sorted.length / 10);
    const bottomDecile = sorted.slice(0, decileSize);
    const topDecile = sorted.slice(-decileSize);

    // Calculate mean outcome for each decile
    const bottomMean = this.mean(bottomDecile.map((p) => p.outcome));
    const topMean = this.mean(topDecile.map((p) => p.outcome));

    return topMean - bottomMean;
  }
}
