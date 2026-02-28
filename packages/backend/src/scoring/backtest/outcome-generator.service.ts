/**
 * Outcome Generator Service
 *
 * Orchestrates outcome generation for backtesting: fetches historical scores,
 * calculates price/rent outcomes at multiple horizons, and persists results.
 *
 * Data access is delegated to OutcomeDataSourceService.
 * Benchmark calculations are delegated to OutcomeBenchmarkService.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type { ScoreType, GeographyType } from '../scoring.types';
import type {
  OutcomeMetrics,
  OutcomeRecord,
  HistoricalDataPoint,
} from './outcome-generator.types';
import { calculateOutcomeDate } from './outcome-generator.types';
import { OutcomeDataSourceService } from './outcome-data-source.service';
import { OutcomeBenchmarkService } from './outcome-benchmark.service';

@Injectable()
export class OutcomeGeneratorService {
  private readonly logger = new Logger(OutcomeGeneratorService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly dataSource: OutcomeDataSourceService,
    private readonly benchmarkService: OutcomeBenchmarkService,
  ) {}

  async generateOutcomes(
    geographyId: string,
    geographyType: GeographyType,
    scoreType: ScoreType,
    scoreDate: string,
    horizons: string[] = ['6m', '1y', '3y', '5y'],
    options?: { includeBenchmarks?: boolean; knownScore?: number },
  ): Promise<OutcomeRecord> {
    const record: OutcomeRecord = {
      geographyId,
      geographyType,
      scoreType,
      scoreDate,
      scoreValue: options?.knownScore ?? null,
    };

    // Skip DB lookup if caller already has the score value
    if (record.scoreValue == null) {
      record.scoreValue = await this.dataSource.getHistoricalScore(
        geographyId,
        geographyType,
        scoreType,
        scoreDate,
      );
    }

    const stateCode = await this.dataSource.getStateCode(
      geographyId,
      geographyType,
    );
    record.stateCode = stateCode ?? undefined;

    const historicalData = await this.dataSource.getHistoricalData(
      geographyId,
      geographyType,
      scoreDate,
    );

    if (!historicalData || historicalData.length === 0) {
      this.logger.warn(
        `No historical data for ${geographyType}:${geographyId} at ${scoreDate}`,
      );
      return record;
    }

    for (const horizon of horizons) {
      const outcomeDate = calculateOutcomeDate(scoreDate, horizon);
      const futureData = await this.dataSource.getHistoricalData(
        geographyId,
        geographyType,
        outcomeDate,
      );

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

    if (options?.includeBenchmarks) {
      record.benchmarks = await this.benchmarkService.calculateBenchmarkReturns(
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

  async generateOutcomesWithBenchmarks(
    geographyId: string,
    geographyType: GeographyType,
    scoreType: ScoreType,
    scoreDate: string,
    horizons: string[] = ['1y', '3y', '5y'],
    knownScore?: number,
  ): Promise<OutcomeRecord> {
    return this.generateOutcomes(
      geographyId,
      geographyType,
      scoreType,
      scoreDate,
      horizons,
      { includeBenchmarks: true, knownScore },
    );
  }

  async generateBatchOutcomes(
    geographyType: GeographyType,
    scoreType: ScoreType,
    scoreDate: string,
    limit: number = 1000,
  ): Promise<OutcomeRecord[]> {
    const geographies = await this.dataSource.getGeographiesWithScores(
      geographyType,
      scoreType,
      scoreDate,
      limit,
    );

    const outcomes: OutcomeRecord[] = [];
    for (const geo of geographies) {
      try {
        const outcome = await this.generateOutcomes(
          geo.id,
          geographyType,
          scoreType,
          scoreDate,
        );
        outcomes.push(outcome);
      } catch (error) {
        this.logger.error(`Error generating outcome for ${geo.id}: ${error}`);
      }
    }
    return outcomes;
  }

  async saveOutcomes(outcomes: OutcomeRecord[]): Promise<void> {
    const client = this.supabase.getClient();
    const now = new Date().toISOString();

    const rows = outcomes.map((outcome) => {
      const b = outcome.benchmarks ?? {};
      return {
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
        state_return_1y: b.stateReturn1y,
        state_return_3y_cagr: b.stateReturn3yCagr,
        state_return_5y_cagr: b.stateReturn5yCagr,
        national_return_1y: b.nationalReturn1y,
        national_return_3y_cagr: b.nationalReturn3yCagr,
        national_return_5y_cagr: b.nationalReturn5yCagr,
        excess_vs_state_1y: b.excessVsState1y,
        excess_vs_state_3y: b.excessVsState3y,
        excess_vs_state_5y: b.excessVsState5y,
        excess_vs_national_1y: b.excessVsNational1y,
        excess_vs_national_3y: b.excessVsNational3y,
        excess_vs_national_5y: b.excessVsNational5y,
        rent_return_1y: b.rentReturn1y,
        rent_return_3y_cagr: b.rentReturn3yCagr,
        state_rent_return_1y: b.stateRentReturn1y,
        state_rent_return_3y_cagr: b.stateRentReturn3yCagr,
        national_rent_return_1y: b.nationalRentReturn1y,
        national_rent_return_3y_cagr: b.nationalRentReturn3yCagr,
        updated_at: now,
      };
    });

    // Batch upsert in chunks of 200
    for (let i = 0; i < rows.length; i += 200) {
      const batch = rows.slice(i, i + 200);
      const { error } = await client
        .from('propertyiq_backtest_outcomes')
        .upsert(batch, {
          onConflict: 'geography_id,geography_type,score_type,score_date',
        });

      if (error) {
        this.logger.error(`Error saving outcome batch: ${error.message}`);
      }
    }
  }

  private calculateOutcomeMetrics(
    startData: HistoricalDataPoint,
    endData: HistoricalDataPoint,
    _scoreType: ScoreType,
    horizon: string,
  ): OutcomeMetrics {
    const metrics: OutcomeMetrics = {};

    if (startData.zhvi && endData.zhvi) {
      metrics.priceChange =
        ((endData.zhvi - startData.zhvi) / startData.zhvi) * 100;

      const years =
        horizon === '3y'
          ? 3
          : horizon === '5y'
            ? 5
            : horizon === '1y'
              ? 1
              : 0.5;
      if (years >= 1) {
        metrics.priceCagr =
          (Math.pow(endData.zhvi / startData.zhvi, 1 / years) - 1) * 100;
      }
    }

    if (startData.zori && endData.zori) {
      metrics.rentChange =
        ((endData.zori - startData.zori) / startData.zori) * 100;
    }

    if (startData.daysOnMarket && endData.daysOnMarket) {
      metrics.daysOnMarketChange =
        endData.daysOnMarket - startData.daysOnMarket;
    }

    if (startData.inventory && endData.inventory) {
      metrics.inventoryChange =
        ((endData.inventory - startData.inventory) / startData.inventory) * 100;
    }

    return metrics;
  }
}
