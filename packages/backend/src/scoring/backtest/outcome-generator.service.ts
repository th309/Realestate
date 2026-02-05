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
 *
 * Enhanced with:
 * - State/national benchmark comparisons
 * - Excess returns (location return - benchmark return)
 * - Rent growth tracking for InvestorEdge validation
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

export interface BenchmarkReturns {
  // State benchmarks
  stateReturn1y?: number;
  stateReturn3yCagr?: number;
  stateReturn5yCagr?: number;

  // National benchmarks
  nationalReturn1y?: number;
  nationalReturn3yCagr?: number;
  nationalReturn5yCagr?: number;

  // Excess returns vs state
  excessVsState1y?: number;
  excessVsState3y?: number;
  excessVsState5y?: number;

  // Excess returns vs national
  excessVsNational1y?: number;
  excessVsNational3y?: number;
  excessVsNational5y?: number;

  // Rent returns
  rentReturn1y?: number;
  rentReturn3yCagr?: number;
  stateRentReturn1y?: number;
  stateRentReturn3yCagr?: number;
  nationalRentReturn1y?: number;
  nationalRentReturn3yCagr?: number;
}

export interface OutcomeRecord {
  geographyId: string;
  geographyType: GeographyType;
  scoreType: ScoreType;
  scoreDate: string;
  scoreValue: number | null;
  stateCode?: string;
  outcome6m?: OutcomeMetrics;
  outcome1y?: OutcomeMetrics;
  outcome3y?: OutcomeMetrics;
  outcome5y?: OutcomeMetrics;
  benchmarks?: BenchmarkReturns;
}

interface HistoricalDataPoint {
  date: string;
  zhvi?: number;
  zori?: number;
  daysOnMarket?: number;
  inventory?: number;
  transactionVolume?: number;
}

interface BenchmarkData {
  zhvi?: number;
  zori?: number;
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
    options?: { includeBenchmarks?: boolean },
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

    // Get state code for benchmark lookups
    const stateCode = await this.getStateCode(geographyId, geographyType);
    record.stateCode = stateCode ?? undefined;

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

    // Calculate benchmark comparisons if requested
    if (options?.includeBenchmarks) {
      record.benchmarks = await this.calculateBenchmarkReturns(
        geographyId,
        geographyType,
        scoreDate,
        stateCode,
        record.outcome1y,
        record.outcome3y,
        record.outcome5y,
      );
    }

    return record;
  }

  /**
   * Generate outcomes with benchmarks for a specific geography
   */
  async generateOutcomesWithBenchmarks(
    geographyId: string,
    geographyType: GeographyType,
    scoreType: ScoreType,
    scoreDate: string,
    horizons: string[] = ['1y', '3y', '5y'],
  ): Promise<OutcomeRecord> {
    return this.generateOutcomes(geographyId, geographyType, scoreType, scoreDate, horizons, {
      includeBenchmarks: true,
    });
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
      const benchmarks = outcome.benchmarks ?? {};

      const { error } = await client.from('propertyiq_backtest_outcomes').upsert(
        {
          geography_id: outcome.geographyId,
          geography_type: outcome.geographyType,
          score_type: outcome.scoreType,
          score_date: outcome.scoreDate,
          score_value: outcome.scoreValue,
          state_code: outcome.stateCode,
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
          // State benchmarks
          state_return_1y: benchmarks.stateReturn1y,
          state_return_3y_cagr: benchmarks.stateReturn3yCagr,
          state_return_5y_cagr: benchmarks.stateReturn5yCagr,
          // National benchmarks
          national_return_1y: benchmarks.nationalReturn1y,
          national_return_3y_cagr: benchmarks.nationalReturn3yCagr,
          national_return_5y_cagr: benchmarks.nationalReturn5yCagr,
          // Excess returns vs state
          excess_vs_state_1y: benchmarks.excessVsState1y,
          excess_vs_state_3y: benchmarks.excessVsState3y,
          excess_vs_state_5y: benchmarks.excessVsState5y,
          // Excess returns vs national
          excess_vs_national_1y: benchmarks.excessVsNational1y,
          excess_vs_national_3y: benchmarks.excessVsNational3y,
          excess_vs_national_5y: benchmarks.excessVsNational5y,
          // Rent returns
          rent_return_1y: benchmarks.rentReturn1y,
          rent_return_3y_cagr: benchmarks.rentReturn3yCagr,
          state_rent_return_1y: benchmarks.stateRentReturn1y,
          state_rent_return_3y_cagr: benchmarks.stateRentReturn3yCagr,
          national_rent_return_1y: benchmarks.nationalRentReturn1y,
          national_rent_return_3y_cagr: benchmarks.nationalRentReturn3yCagr,
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
      case 'markethealth':
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

  private getZillowTable(geographyType: GeographyType | string): string {
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

  private getIdColumn(geographyType: GeographyType | string): string {
    // All Zillow tables use region_id
    return 'region_id';
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

  // ========================================================================
  // Benchmark Calculation Methods
  // ========================================================================

  /**
   * Get state code for a geography ID
   */
  private async getStateCode(
    geographyId: string,
    geographyType: GeographyType,
  ): Promise<string | null> {
    const client = this.supabase.getClient();

    // Different lookup tables based on geography type
    switch (geographyType) {
      case 'metro': {
        const { data } = await client
          .from('zillow_metro')
          .select('state_name')
          .eq('region_id', geographyId)
          .limit(1)
          .single();
        // State code from metro - metros can span states, return primary state
        return data?.state_name?.substring(0, 2) || null;
      }
      case 'county': {
        // County FIPS: first 2 digits are state FIPS
        const stateFips = geographyId.substring(0, 2);
        const { data } = await client
          .from('census_county')
          .select('state_code')
          .eq('fips_code', geographyId)
          .limit(1)
          .single();
        return data?.state_code || null;
      }
      case 'zip': {
        const { data } = await client
          .from('zillow_zip')
          .select('state_name')
          .eq('region_id', geographyId)
          .limit(1)
          .single();
        return data?.state_name || null;
      }
      default:
        return null;
    }
  }

  /**
   * Get benchmark data (ZHVI/ZORI) for state or national level
   */
  private async getBenchmarkData(
    level: 'state' | 'national',
    stateCode: string | null,
    date: string,
    metric: 'zhvi' | 'zori' = 'zhvi',
  ): Promise<BenchmarkData | null> {
    const client = this.supabase.getClient();

    if (level === 'national') {
      // Use national Zillow data
      const { data, error } = await client
        .from('zillow_state')
        .select('value')
        .eq('region_name', 'United States')
        .eq('metric_name', metric)
        .lte('period_date', date)
        .order('period_date', { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) return null;
      return metric === 'zhvi' ? { zhvi: data[0].value } : { zori: data[0].value };
    }

    if (level === 'state' && stateCode) {
      const { data, error } = await client
        .from('zillow_state')
        .select('value')
        .eq('state_name', stateCode)
        .eq('metric_name', metric)
        .lte('period_date', date)
        .order('period_date', { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) return null;
      return metric === 'zhvi' ? { zhvi: data[0].value } : { zori: data[0].value };
    }

    return null;
  }

  /**
   * Calculate return between two data points
   */
  private calculateReturn(
    startValue: number | undefined,
    endValue: number | undefined,
    years: number,
  ): { change: number; cagr: number } | null {
    if (!startValue || !endValue || startValue === 0) return null;

    const change = ((endValue - startValue) / startValue) * 100;
    const cagr = years >= 1 ? (Math.pow(endValue / startValue, 1 / years) - 1) * 100 : change;

    return { change, cagr };
  }

  /**
   * Calculate benchmark returns for all horizons
   */
  private async calculateBenchmarkReturns(
    geographyId: string,
    geographyType: GeographyType,
    scoreDate: string,
    stateCode: string | null | undefined,
    outcome1y: OutcomeMetrics | undefined,
    outcome3y: OutcomeMetrics | undefined,
    outcome5y: OutcomeMetrics | undefined,
  ): Promise<BenchmarkReturns> {
    const benchmarks: BenchmarkReturns = {};
    const client = this.supabase.getClient();

    // Get start date benchmark data
    const stateStartZhvi = await this.getBenchmarkData('state', stateCode ?? null, scoreDate, 'zhvi');
    const nationalStartZhvi = await this.getBenchmarkData('national', null, scoreDate, 'zhvi');
    const stateStartZori = await this.getBenchmarkData('state', stateCode ?? null, scoreDate, 'zori');
    const nationalStartZori = await this.getBenchmarkData('national', null, scoreDate, 'zori');

    // Calculate location rent returns
    const locationStartData = await this.getHistoricalData(geographyId, geographyType, scoreDate);
    const location1yData = await this.getHistoricalData(
      geographyId,
      geographyType,
      this.calculateOutcomeDate(scoreDate, '1y'),
    );
    const location3yData = await this.getHistoricalData(
      geographyId,
      geographyType,
      this.calculateOutcomeDate(scoreDate, '3y'),
    );

    // Calculate rent returns for location
    if (locationStartData?.[0]?.zori && location1yData?.[0]?.zori) {
      const rentReturn = this.calculateReturn(locationStartData[0].zori, location1yData[0].zori, 1);
      if (rentReturn) benchmarks.rentReturn1y = rentReturn.change;
    }
    if (locationStartData?.[0]?.zori && location3yData?.[0]?.zori) {
      const rentReturn = this.calculateReturn(locationStartData[0].zori, location3yData[0].zori, 3);
      if (rentReturn) benchmarks.rentReturn3yCagr = rentReturn.cagr;
    }

    // Calculate 1Y benchmarks
    if (outcome1y?.priceChange !== undefined) {
      const date1y = this.calculateOutcomeDate(scoreDate, '1y');
      const stateEnd1y = await this.getBenchmarkData('state', stateCode ?? null, date1y, 'zhvi');
      const nationalEnd1y = await this.getBenchmarkData('national', null, date1y, 'zhvi');
      const stateRentEnd1y = await this.getBenchmarkData('state', stateCode ?? null, date1y, 'zori');
      const nationalRentEnd1y = await this.getBenchmarkData('national', null, date1y, 'zori');

      // State 1Y return
      if (stateStartZhvi?.zhvi && stateEnd1y?.zhvi) {
        const stateReturn = this.calculateReturn(stateStartZhvi.zhvi, stateEnd1y.zhvi, 1);
        if (stateReturn) {
          benchmarks.stateReturn1y = stateReturn.change;
          benchmarks.excessVsState1y = outcome1y.priceChange - stateReturn.change;
        }
      }

      // National 1Y return
      if (nationalStartZhvi?.zhvi && nationalEnd1y?.zhvi) {
        const nationalReturn = this.calculateReturn(nationalStartZhvi.zhvi, nationalEnd1y.zhvi, 1);
        if (nationalReturn) {
          benchmarks.nationalReturn1y = nationalReturn.change;
          benchmarks.excessVsNational1y = outcome1y.priceChange - nationalReturn.change;
        }
      }

      // State rent 1Y return
      if (stateStartZori?.zori && stateRentEnd1y?.zori) {
        const stateRentReturn = this.calculateReturn(stateStartZori.zori, stateRentEnd1y.zori, 1);
        if (stateRentReturn) benchmarks.stateRentReturn1y = stateRentReturn.change;
      }

      // National rent 1Y return
      if (nationalStartZori?.zori && nationalRentEnd1y?.zori) {
        const nationalRentReturn = this.calculateReturn(nationalStartZori.zori, nationalRentEnd1y.zori, 1);
        if (nationalRentReturn) benchmarks.nationalRentReturn1y = nationalRentReturn.change;
      }
    }

    // Calculate 3Y benchmarks
    if (outcome3y?.priceCagr !== undefined) {
      const date3y = this.calculateOutcomeDate(scoreDate, '3y');
      const stateEnd3y = await this.getBenchmarkData('state', stateCode ?? null, date3y, 'zhvi');
      const nationalEnd3y = await this.getBenchmarkData('national', null, date3y, 'zhvi');
      const stateRentEnd3y = await this.getBenchmarkData('state', stateCode ?? null, date3y, 'zori');
      const nationalRentEnd3y = await this.getBenchmarkData('national', null, date3y, 'zori');

      // State 3Y CAGR
      if (stateStartZhvi?.zhvi && stateEnd3y?.zhvi) {
        const stateReturn = this.calculateReturn(stateStartZhvi.zhvi, stateEnd3y.zhvi, 3);
        if (stateReturn) {
          benchmarks.stateReturn3yCagr = stateReturn.cagr;
          benchmarks.excessVsState3y = outcome3y.priceCagr - stateReturn.cagr;
        }
      }

      // National 3Y CAGR
      if (nationalStartZhvi?.zhvi && nationalEnd3y?.zhvi) {
        const nationalReturn = this.calculateReturn(nationalStartZhvi.zhvi, nationalEnd3y.zhvi, 3);
        if (nationalReturn) {
          benchmarks.nationalReturn3yCagr = nationalReturn.cagr;
          benchmarks.excessVsNational3y = outcome3y.priceCagr - nationalReturn.cagr;
        }
      }

      // State rent 3Y CAGR
      if (stateStartZori?.zori && stateRentEnd3y?.zori) {
        const stateRentReturn = this.calculateReturn(stateStartZori.zori, stateRentEnd3y.zori, 3);
        if (stateRentReturn) benchmarks.stateRentReturn3yCagr = stateRentReturn.cagr;
      }

      // National rent 3Y CAGR
      if (nationalStartZori?.zori && nationalRentEnd3y?.zori) {
        const nationalRentReturn = this.calculateReturn(nationalStartZori.zori, nationalRentEnd3y.zori, 3);
        if (nationalRentReturn) benchmarks.nationalRentReturn3yCagr = nationalRentReturn.cagr;
      }
    }

    // Calculate 5Y benchmarks
    if (outcome5y?.priceCagr !== undefined) {
      const date5y = this.calculateOutcomeDate(scoreDate, '5y');
      const stateEnd5y = await this.getBenchmarkData('state', stateCode ?? null, date5y, 'zhvi');
      const nationalEnd5y = await this.getBenchmarkData('national', null, date5y, 'zhvi');

      // State 5Y CAGR
      if (stateStartZhvi?.zhvi && stateEnd5y?.zhvi) {
        const stateReturn = this.calculateReturn(stateStartZhvi.zhvi, stateEnd5y.zhvi, 5);
        if (stateReturn) {
          benchmarks.stateReturn5yCagr = stateReturn.cagr;
          benchmarks.excessVsState5y = outcome5y.priceCagr - stateReturn.cagr;
        }
      }

      // National 5Y CAGR
      if (nationalStartZhvi?.zhvi && nationalEnd5y?.zhvi) {
        const nationalReturn = this.calculateReturn(nationalStartZhvi.zhvi, nationalEnd5y.zhvi, 5);
        if (nationalReturn) {
          benchmarks.nationalReturn5yCagr = nationalReturn.cagr;
          benchmarks.excessVsNational5y = outcome5y.priceCagr - nationalReturn.cagr;
        }
      }
    }

    return benchmarks;
  }
}
