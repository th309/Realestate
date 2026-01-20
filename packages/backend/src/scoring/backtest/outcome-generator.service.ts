/**
 * Outcome Generator Service
 *
 * Calculates actual outcomes from historical data for backtesting.
 * Compares what scores predicted vs what actually happened.
 *
 * Outcome types by score:
 * - HomeReady: Price appreciation, volatility, time to sell
 * - InvestorEdge: Rent growth, cap rate, total return
 * - Market Health: Price stability, transaction volume
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type { ScoreType, GeographyType } from '../scoring.types';

export interface OutcomeMetrics {
  // Price metrics
  priceChange?: number;
  priceCagr?: number;
  priceVolatility?: number;

  // Rent metrics
  rentChange?: number;
  rentCagr?: number;

  // Investment metrics
  capRateChange?: number;
  totalReturn?: number;

  // Market metrics
  daysOnMarketChange?: number;
  inventoryChange?: number;
  transactionVolumeChange?: number;
}

export interface OutcomeRecord {
  geographyId: string;
  geographyType: GeographyType;
  scoreType: ScoreType;
  scoreDate: string;
  scoreValue: number | null;
  outcome6m?: OutcomeMetrics;
  outcome1y?: OutcomeMetrics;
  outcome3y?: OutcomeMetrics;
  outcome5y?: OutcomeMetrics;
}

interface HistoricalDataPoint {
  date: string;
  zhvi?: number;
  zori?: number;
  daysOnMarket?: number;
  inventory?: number;
  transactionVolume?: number;
}

@Injectable()
export class OutcomeGeneratorService {
  private readonly logger = new Logger(OutcomeGeneratorService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Generate outcomes for a specific geography and time period
   */
  async generateOutcomes(
    geographyId: string,
    geographyType: GeographyType,
    scoreType: ScoreType,
    scoreDate: string,
    horizons: string[] = ['6m', '1y', '3y', '5y'],
  ): Promise<OutcomeRecord> {
    const record: OutcomeRecord = {
      geographyId,
      geographyType,
      scoreType,
      scoreDate,
      scoreValue: null,
    };

    // Get historical score at scoreDate
    const score = await this.getHistoricalScore(geographyId, geographyType, scoreType, scoreDate);
    record.scoreValue = score;

    // Get historical data for outcome calculation
    const historicalData = await this.getHistoricalData(geographyId, geographyType, scoreDate);

    if (!historicalData || historicalData.length === 0) {
      this.logger.warn(`No historical data found for ${geographyType}:${geographyId} at ${scoreDate}`);
      return record;
    }

    // Calculate outcomes for each horizon
    for (const horizon of horizons) {
      const outcomeDate = this.calculateOutcomeDate(scoreDate, horizon);
      const futureData = await this.getHistoricalData(geographyId, geographyType, outcomeDate);

      if (futureData && futureData.length > 0) {
        const outcome = this.calculateOutcomeMetrics(
          historicalData[0],
          futureData[0],
          scoreType,
          horizon,
        );

        switch (horizon) {
          case '6m':
            record.outcome6m = outcome;
            break;
          case '1y':
            record.outcome1y = outcome;
            break;
          case '3y':
            record.outcome3y = outcome;
            break;
          case '5y':
            record.outcome5y = outcome;
            break;
        }
      }
    }

    return record;
  }

  /**
   * Batch generate outcomes for multiple geographies
   */
  async generateBatchOutcomes(
    geographyType: GeographyType,
    scoreType: ScoreType,
    scoreDate: string,
    limit: number = 1000,
  ): Promise<OutcomeRecord[]> {
    // Get list of geographies with scores at this date
    const geographies = await this.getGeographiesWithScores(geographyType, scoreType, scoreDate, limit);

    const outcomes: OutcomeRecord[] = [];

    for (const geo of geographies) {
      try {
        const outcome = await this.generateOutcomes(geo.id, geographyType, scoreType, scoreDate);
        outcomes.push(outcome);
      } catch (error) {
        this.logger.error(`Error generating outcome for ${geo.id}: ${error}`);
      }
    }

    return outcomes;
  }

  /**
   * Save outcomes to database
   */
  async saveOutcomes(outcomes: OutcomeRecord[]): Promise<void> {
    const client = this.supabase.getClient();

    for (const outcome of outcomes) {
      const { error } = await client.from('propertyiq_backtest_outcomes').upsert(
        {
          geography_id: outcome.geographyId,
          geography_type: outcome.geographyType,
          score_type: outcome.scoreType,
          score_date: outcome.scoreDate,
          score_value: outcome.scoreValue,
          outcome_6m_value: outcome.outcome6m?.priceChange,
          outcome_1y_value: outcome.outcome1y?.priceChange,
          outcome_3y_value: outcome.outcome3y?.priceCagr,
          outcome_5y_value: outcome.outcome5y?.priceCagr,
          outcome_metrics: {
            outcome_6m: outcome.outcome6m,
            outcome_1y: outcome.outcome1y,
            outcome_3y: outcome.outcome3y,
            outcome_5y: outcome.outcome5y,
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'geography_id,geography_type,score_type,score_date' },
      );

      if (error) {
        this.logger.error(`Error saving outcome for ${outcome.geographyId}: ${error.message}`);
      }
    }
  }

  // ========================================================================
  // Private Helper Methods
  // ========================================================================

  private async getHistoricalScore(
    geographyId: string,
    geographyType: GeographyType,
    scoreType: ScoreType,
    date: string,
  ): Promise<number | null> {
    const client = this.supabase.getClient();

    const scoreColumn = this.getScoreColumn(scoreType);

    const { data, error } = await client
      .from('propertyiq_scores')
      .select(scoreColumn)
      .eq('geography_id', geographyId)
      .eq('geography_type', geographyType)
      .eq('period_date', date)
      .single();

    if (error || !data) return null;
    return data[scoreColumn] as number | null;
  }

  private getScoreColumn(scoreType: ScoreType): string {
    switch (scoreType) {
      case 'market_health':
        return 'market_health_score';
      case 'homeready':
        return 'homeready_score';
      case 'investoredge':
        return 'investoredge_score';
      default:
        return 'homeready_score';
    }
  }

  private async getHistoricalData(
    geographyId: string,
    geographyType: GeographyType,
    date: string,
  ): Promise<HistoricalDataPoint[] | null> {
    const client = this.supabase.getClient();

    // Get ZHVI data
    const table = this.getZillowTable(geographyType);
    const idColumn = this.getIdColumn(geographyType);

    const { data, error } = await client
      .from(table)
      .select('period_date, value')
      .eq(idColumn, geographyId)
      .eq('metric_name', 'zhvi')
      .lte('period_date', date)
      .order('period_date', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) return null;

    return [
      {
        date: data[0].period_date,
        zhvi: data[0].value,
      },
    ];
  }

  private getZillowTable(geographyType: GeographyType): string {
    switch (geographyType) {
      case 'state':
        return 'zillow_state';
      case 'metro':
        return 'zillow_metro';
      case 'county':
        return 'zillow_county';
      case 'city':
        return 'zillow_city';
      case 'zip':
        return 'zillow_zip';
      default:
        return 'zillow_metro';
    }
  }

  private getIdColumn(geographyType: GeographyType): string {
    switch (geographyType) {
      case 'state':
        return 'region_id';
      case 'metro':
        return 'region_id';
      case 'county':
        return 'region_id';
      case 'city':
        return 'region_id';
      case 'zip':
        return 'region_id';
      default:
        return 'region_id';
    }
  }

  private calculateOutcomeDate(startDate: string, horizon: string): string {
    const date = new Date(startDate);

    switch (horizon) {
      case '6m':
        date.setMonth(date.getMonth() + 6);
        break;
      case '1y':
        date.setFullYear(date.getFullYear() + 1);
        break;
      case '3y':
        date.setFullYear(date.getFullYear() + 3);
        break;
      case '5y':
        date.setFullYear(date.getFullYear() + 5);
        break;
    }

    return date.toISOString().split('T')[0];
  }

  private calculateOutcomeMetrics(
    startData: HistoricalDataPoint,
    endData: HistoricalDataPoint,
    scoreType: ScoreType,
    horizon: string,
  ): OutcomeMetrics {
    const metrics: OutcomeMetrics = {};

    // Price change
    if (startData.zhvi && endData.zhvi) {
      metrics.priceChange = ((endData.zhvi - startData.zhvi) / startData.zhvi) * 100;

      // Calculate CAGR for multi-year horizons
      const years = horizon === '3y' ? 3 : horizon === '5y' ? 5 : horizon === '1y' ? 1 : 0.5;
      if (years >= 1) {
        metrics.priceCagr = (Math.pow(endData.zhvi / startData.zhvi, 1 / years) - 1) * 100;
      }
    }

    // Rent change
    if (startData.zori && endData.zori) {
      metrics.rentChange = ((endData.zori - startData.zori) / startData.zori) * 100;
    }

    // Days on market change
    if (startData.daysOnMarket && endData.daysOnMarket) {
      metrics.daysOnMarketChange = endData.daysOnMarket - startData.daysOnMarket;
    }

    // Inventory change
    if (startData.inventory && endData.inventory) {
      metrics.inventoryChange = ((endData.inventory - startData.inventory) / startData.inventory) * 100;
    }

    return metrics;
  }

  private async getGeographiesWithScores(
    geographyType: GeographyType,
    scoreType: ScoreType,
    date: string,
    limit: number,
  ): Promise<Array<{ id: string }>> {
    const client = this.supabase.getClient();
    const scoreColumn = this.getScoreColumn(scoreType);

    const { data, error } = await client
      .from('propertyiq_scores')
      .select('geography_id')
      .eq('geography_type', geographyType)
      .eq('period_date', date)
      .not(scoreColumn, 'is', null)
      .limit(limit);

    if (error || !data) return [];
    return data.map((d) => ({ id: d.geography_id }));
  }
}
