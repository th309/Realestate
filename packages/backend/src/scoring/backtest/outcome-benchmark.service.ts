/**
 * Outcome Benchmark Service
 *
 * Calculates benchmark returns (state & national) for comparison with
 * location-level outcomes. Produces excess return metrics.
 */

import { Injectable } from '@nestjs/common';
import type { GeographyType } from '../scoring.types';
import type {
  OutcomeMetrics,
  BenchmarkReturns,
} from './outcome-generator.types';
import {
  calculateOutcomeDate,
  calculateReturn,
} from './outcome-generator.types';
import { OutcomeDataSourceService } from './outcome-data-source.service';

@Injectable()
export class OutcomeBenchmarkService {
  constructor(private readonly dataSource: OutcomeDataSourceService) {}

  async calculateBenchmarkReturns(
    geographyId: string,
    geographyType: GeographyType,
    scoreDate: string,
    stateCode: string | null | undefined,
    outcome1y: OutcomeMetrics | undefined,
    outcome3y: OutcomeMetrics | undefined,
    outcome5y: OutcomeMetrics | undefined,
  ): Promise<BenchmarkReturns> {
    const benchmarks: BenchmarkReturns = {};

    // Get start date benchmark data
    const stateStartZhvi = await this.dataSource.getBenchmarkData(
      'state',
      stateCode ?? null,
      scoreDate,
      'zhvi',
    );
    const nationalStartZhvi = await this.dataSource.getBenchmarkData(
      'national',
      null,
      scoreDate,
      'zhvi',
    );
    const stateStartZori = await this.dataSource.getBenchmarkData(
      'state',
      stateCode ?? null,
      scoreDate,
      'zori',
    );
    const nationalStartZori = await this.dataSource.getBenchmarkData(
      'national',
      null,
      scoreDate,
      'zori',
    );

    // Calculate location rent returns
    const locationStartData = await this.dataSource.getHistoricalData(
      geographyId,
      geographyType,
      scoreDate,
    );
    const location1yData = await this.dataSource.getHistoricalData(
      geographyId,
      geographyType,
      calculateOutcomeDate(scoreDate, '1y'),
    );
    const location3yData = await this.dataSource.getHistoricalData(
      geographyId,
      geographyType,
      calculateOutcomeDate(scoreDate, '3y'),
    );

    if (locationStartData?.[0]?.zori && location1yData?.[0]?.zori) {
      const rentReturn = calculateReturn(
        locationStartData[0].zori,
        location1yData[0].zori,
        1,
      );
      if (rentReturn) benchmarks.rentReturn1y = rentReturn.change;
    }
    if (locationStartData?.[0]?.zori && location3yData?.[0]?.zori) {
      const rentReturn = calculateReturn(
        locationStartData[0].zori,
        location3yData[0].zori,
        3,
      );
      if (rentReturn) benchmarks.rentReturn3yCagr = rentReturn.cagr;
    }

    // 1Y benchmarks
    if (outcome1y?.priceChange !== undefined) {
      await this.calculate1yBenchmarks(
        benchmarks,
        scoreDate,
        stateCode,
        outcome1y,
        stateStartZhvi,
        nationalStartZhvi,
        stateStartZori,
        nationalStartZori,
      );
    }

    // 3Y benchmarks
    if (outcome3y?.priceCagr !== undefined) {
      await this.calculate3yBenchmarks(
        benchmarks,
        scoreDate,
        stateCode,
        outcome3y,
        stateStartZhvi,
        nationalStartZhvi,
        stateStartZori,
        nationalStartZori,
      );
    }

    // 5Y benchmarks
    if (outcome5y?.priceCagr !== undefined) {
      await this.calculate5yBenchmarks(
        benchmarks,
        scoreDate,
        stateCode,
        outcome5y,
        stateStartZhvi,
        nationalStartZhvi,
      );
    }

    return benchmarks;
  }

  private async calculate1yBenchmarks(
    benchmarks: BenchmarkReturns,
    scoreDate: string,
    stateCode: string | null | undefined,
    outcome1y: OutcomeMetrics,
    stateStartZhvi: { zhvi?: number; zori?: number } | null,
    nationalStartZhvi: { zhvi?: number; zori?: number } | null,
    stateStartZori: { zhvi?: number; zori?: number } | null,
    nationalStartZori: { zhvi?: number; zori?: number } | null,
  ): Promise<void> {
    const date1y = calculateOutcomeDate(scoreDate, '1y');
    const stateEnd1y = await this.dataSource.getBenchmarkData(
      'state',
      stateCode ?? null,
      date1y,
      'zhvi',
    );
    const nationalEnd1y = await this.dataSource.getBenchmarkData(
      'national',
      null,
      date1y,
      'zhvi',
    );
    const stateRentEnd1y = await this.dataSource.getBenchmarkData(
      'state',
      stateCode ?? null,
      date1y,
      'zori',
    );
    const nationalRentEnd1y = await this.dataSource.getBenchmarkData(
      'national',
      null,
      date1y,
      'zori',
    );

    if (stateStartZhvi?.zhvi && stateEnd1y?.zhvi) {
      const stateReturn = calculateReturn(
        stateStartZhvi.zhvi,
        stateEnd1y.zhvi,
        1,
      );
      if (stateReturn) {
        benchmarks.stateReturn1y = stateReturn.change;
        benchmarks.excessVsState1y =
          outcome1y.priceChange! - stateReturn.change;
      }
    }

    if (nationalStartZhvi?.zhvi && nationalEnd1y?.zhvi) {
      const nationalReturn = calculateReturn(
        nationalStartZhvi.zhvi,
        nationalEnd1y.zhvi,
        1,
      );
      if (nationalReturn) {
        benchmarks.nationalReturn1y = nationalReturn.change;
        benchmarks.excessVsNational1y =
          outcome1y.priceChange! - nationalReturn.change;
      }
    }

    if (stateStartZori?.zori && stateRentEnd1y?.zori) {
      const stateRentReturn = calculateReturn(
        stateStartZori.zori,
        stateRentEnd1y.zori,
        1,
      );
      if (stateRentReturn)
        benchmarks.stateRentReturn1y = stateRentReturn.change;
    }

    if (nationalStartZori?.zori && nationalRentEnd1y?.zori) {
      const nationalRentReturn = calculateReturn(
        nationalStartZori.zori,
        nationalRentEnd1y.zori,
        1,
      );
      if (nationalRentReturn)
        benchmarks.nationalRentReturn1y = nationalRentReturn.change;
    }
  }

  private async calculate3yBenchmarks(
    benchmarks: BenchmarkReturns,
    scoreDate: string,
    stateCode: string | null | undefined,
    outcome3y: OutcomeMetrics,
    stateStartZhvi: { zhvi?: number; zori?: number } | null,
    nationalStartZhvi: { zhvi?: number; zori?: number } | null,
    stateStartZori: { zhvi?: number; zori?: number } | null,
    nationalStartZori: { zhvi?: number; zori?: number } | null,
  ): Promise<void> {
    const date3y = calculateOutcomeDate(scoreDate, '3y');
    const stateEnd3y = await this.dataSource.getBenchmarkData(
      'state',
      stateCode ?? null,
      date3y,
      'zhvi',
    );
    const nationalEnd3y = await this.dataSource.getBenchmarkData(
      'national',
      null,
      date3y,
      'zhvi',
    );
    const stateRentEnd3y = await this.dataSource.getBenchmarkData(
      'state',
      stateCode ?? null,
      date3y,
      'zori',
    );
    const nationalRentEnd3y = await this.dataSource.getBenchmarkData(
      'national',
      null,
      date3y,
      'zori',
    );

    if (stateStartZhvi?.zhvi && stateEnd3y?.zhvi) {
      const stateReturn = calculateReturn(
        stateStartZhvi.zhvi,
        stateEnd3y.zhvi,
        3,
      );
      if (stateReturn) {
        benchmarks.stateReturn3yCagr = stateReturn.cagr;
        benchmarks.excessVsState3y = outcome3y.priceCagr! - stateReturn.cagr;
      }
    }

    if (nationalStartZhvi?.zhvi && nationalEnd3y?.zhvi) {
      const nationalReturn = calculateReturn(
        nationalStartZhvi.zhvi,
        nationalEnd3y.zhvi,
        3,
      );
      if (nationalReturn) {
        benchmarks.nationalReturn3yCagr = nationalReturn.cagr;
        benchmarks.excessVsNational3y =
          outcome3y.priceCagr! - nationalReturn.cagr;
      }
    }

    if (stateStartZori?.zori && stateRentEnd3y?.zori) {
      const stateRentReturn = calculateReturn(
        stateStartZori.zori,
        stateRentEnd3y.zori,
        3,
      );
      if (stateRentReturn)
        benchmarks.stateRentReturn3yCagr = stateRentReturn.cagr;
    }

    if (nationalStartZori?.zori && nationalRentEnd3y?.zori) {
      const nationalRentReturn = calculateReturn(
        nationalStartZori.zori,
        nationalRentEnd3y.zori,
        3,
      );
      if (nationalRentReturn)
        benchmarks.nationalRentReturn3yCagr = nationalRentReturn.cagr;
    }
  }

  private async calculate5yBenchmarks(
    benchmarks: BenchmarkReturns,
    scoreDate: string,
    stateCode: string | null | undefined,
    outcome5y: OutcomeMetrics,
    stateStartZhvi: { zhvi?: number; zori?: number } | null,
    nationalStartZhvi: { zhvi?: number; zori?: number } | null,
  ): Promise<void> {
    const date5y = calculateOutcomeDate(scoreDate, '5y');
    const stateEnd5y = await this.dataSource.getBenchmarkData(
      'state',
      stateCode ?? null,
      date5y,
      'zhvi',
    );
    const nationalEnd5y = await this.dataSource.getBenchmarkData(
      'national',
      null,
      date5y,
      'zhvi',
    );

    if (stateStartZhvi?.zhvi && stateEnd5y?.zhvi) {
      const stateReturn = calculateReturn(
        stateStartZhvi.zhvi,
        stateEnd5y.zhvi,
        5,
      );
      if (stateReturn) {
        benchmarks.stateReturn5yCagr = stateReturn.cagr;
        benchmarks.excessVsState5y = outcome5y.priceCagr! - stateReturn.cagr;
      }
    }

    if (nationalStartZhvi?.zhvi && nationalEnd5y?.zhvi) {
      const nationalReturn = calculateReturn(
        nationalStartZhvi.zhvi,
        nationalEnd5y.zhvi,
        5,
      );
      if (nationalReturn) {
        benchmarks.nationalReturn5yCagr = nationalReturn.cagr;
        benchmarks.excessVsNational5y =
          outcome5y.priceCagr! - nationalReturn.cagr;
      }
    }
  }
}
