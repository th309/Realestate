/**
 * Outcome Benchmark Service Unit Tests
 *
 * Tests benchmark return calculations with mocked OutcomeDataSourceService.
 * The benchmark service computes state/national return comparisons and
 * excess returns for each horizon (1Y, 3Y, 5Y).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { OutcomeBenchmarkService } from '../../../backtest/outcome-benchmark.service';
import { OutcomeDataSourceService } from '../../../backtest/outcome-data-source.service';
import { SupabaseService } from '../../../../supabase/supabase.service';
import type { OutcomeMetrics } from '../../../backtest/outcome-generator.types';

describe('OutcomeBenchmarkService', () => {
  let service: OutcomeBenchmarkService;
  let mockDataSource: jest.Mocked<OutcomeDataSourceService>;

  beforeEach(async () => {
    mockDataSource = {
      getBenchmarkData: jest.fn().mockResolvedValue(null),
      getHistoricalData: jest.fn().mockResolvedValue(null),
      getHistoricalScore: jest.fn().mockResolvedValue(null),
      getGeographiesWithScores: jest.fn().mockResolvedValue([]),
      getStateCode: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<OutcomeDataSourceService>;

    const mockSupabase = {
      getClient: jest.fn(),
    } as unknown as jest.Mocked<SupabaseService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutcomeBenchmarkService,
        { provide: OutcomeDataSourceService, useValue: mockDataSource },
        { provide: SupabaseService, useValue: mockSupabase },
      ],
    }).compile();

    service = module.get<OutcomeBenchmarkService>(OutcomeBenchmarkService);
  });

  // ==========================================================================
  // Helpers
  // ==========================================================================

  const SCORE_DATE = '2020-06-01';
  const STATE_CODE = 'CA';

  /** Configure mock getBenchmarkData to return values based on arguments */
  function setupBenchmarkMock(
    stateZhvi: Record<string, number>,
    nationalZhvi: Record<string, number>,
    stateZori: Record<string, number> = {},
    nationalZori: Record<string, number> = {},
  ) {
    mockDataSource.getBenchmarkData.mockImplementation(
      async (level, stateCode, date, metric) => {
        if (metric === 'zori') {
          if (level === 'state' && stateZori[date] !== undefined)
            return { zori: stateZori[date] };
          if (level === 'national' && nationalZori[date] !== undefined)
            return { zori: nationalZori[date] };
          return null;
        }
        // zhvi
        if (level === 'state' && stateZhvi[date] !== undefined)
          return { zhvi: stateZhvi[date] };
        if (level === 'national' && nationalZhvi[date] !== undefined)
          return { zhvi: nationalZhvi[date] };
        return null;
      },
    );
  }

  // ==========================================================================
  // 1Y Benchmarks
  // ==========================================================================

  describe('1Y benchmark returns', () => {
    const outcome1y: OutcomeMetrics = { priceChange: 12 };

    it('calculates state and national 1Y returns with excess', async () => {
      // State: $400K → $440K = 10% return
      // National: $350K → $371K = 6% return
      setupBenchmarkMock(
        { [SCORE_DATE]: 400000, '2021-06-01': 440000 },
        { [SCORE_DATE]: 350000, '2021-06-01': 371000 },
      );

      const result = await service.calculateBenchmarkReturns(
        '31080',
        'metro',
        SCORE_DATE,
        STATE_CODE,
        outcome1y,
        undefined,
        undefined,
      );

      expect(result.stateReturn1y).toBeCloseTo(10, 0);
      expect(result.nationalReturn1y).toBeCloseTo(6, 0);
      // Excess = location return (12%) - benchmark return
      expect(result.excessVsState1y).toBeCloseTo(2, 0);
      expect(result.excessVsNational1y).toBeCloseTo(6, 0);
    });

    it('skips 1Y benchmarks when outcome1y has no priceChange', async () => {
      setupBenchmarkMock(
        { [SCORE_DATE]: 400000, '2021-06-01': 440000 },
        { [SCORE_DATE]: 350000, '2021-06-01': 371000 },
      );

      const result = await service.calculateBenchmarkReturns(
        '31080',
        'metro',
        SCORE_DATE,
        STATE_CODE,
        undefined, // no 1y outcome
        undefined,
        undefined,
      );

      expect(result.stateReturn1y).toBeUndefined();
      expect(result.nationalReturn1y).toBeUndefined();
    });
  });

  // ==========================================================================
  // 3Y Benchmarks
  // ==========================================================================

  describe('3Y benchmark returns', () => {
    const outcome3y: OutcomeMetrics = { priceCagr: 8 };

    it('calculates state and national 3Y CAGR with excess', async () => {
      // State: $400K → $504K over 3Y = ~8% CAGR
      // National: $350K → $416K over 3Y = ~5.9% CAGR
      setupBenchmarkMock(
        { [SCORE_DATE]: 400000, '2023-06-01': 504000 },
        { [SCORE_DATE]: 350000, '2023-06-01': 416000 },
      );

      const result = await service.calculateBenchmarkReturns(
        '31080',
        'metro',
        SCORE_DATE,
        STATE_CODE,
        undefined,
        outcome3y,
        undefined,
      );

      expect(result.stateReturn3yCagr).toBeDefined();
      expect(result.nationalReturn3yCagr).toBeDefined();
      expect(result.excessVsState3y).toBeDefined();
      expect(result.excessVsNational3y).toBeDefined();
      // Excess = location CAGR (8%) - benchmark CAGR
      expect(result.excessVsState3y).toBeCloseTo(
        8 - result.stateReturn3yCagr!,
        5,
      );
    });

    it('skips 3Y benchmarks when outcome3y has no priceCagr', async () => {
      setupBenchmarkMock(
        { [SCORE_DATE]: 400000, '2023-06-01': 504000 },
        { [SCORE_DATE]: 350000, '2023-06-01': 416000 },
      );

      const result = await service.calculateBenchmarkReturns(
        '31080',
        'metro',
        SCORE_DATE,
        STATE_CODE,
        undefined,
        undefined,
        undefined,
      );

      expect(result.stateReturn3yCagr).toBeUndefined();
      expect(result.nationalReturn3yCagr).toBeUndefined();
    });
  });

  // ==========================================================================
  // 5Y Benchmarks
  // ==========================================================================

  describe('5Y benchmark returns', () => {
    const outcome5y: OutcomeMetrics = { priceCagr: 7 };

    it('calculates state and national 5Y CAGR with excess', async () => {
      // State: $400K → $560K over 5Y = ~7% CAGR
      // National: $350K → $450K over 5Y = ~5.1% CAGR
      setupBenchmarkMock(
        { [SCORE_DATE]: 400000, '2025-06-01': 560000 },
        { [SCORE_DATE]: 350000, '2025-06-01': 450000 },
      );

      const result = await service.calculateBenchmarkReturns(
        '31080',
        'metro',
        SCORE_DATE,
        STATE_CODE,
        undefined,
        undefined,
        outcome5y,
      );

      expect(result.stateReturn5yCagr).toBeDefined();
      expect(result.nationalReturn5yCagr).toBeDefined();
      expect(result.excessVsState5y).toBeDefined();
      expect(result.excessVsNational5y).toBeDefined();
    });
  });

  // ==========================================================================
  // Rent Benchmarks
  // ==========================================================================

  describe('rent return benchmarks', () => {
    it('calculates rent returns when ZORI data exists', async () => {
      // Setup state/national ZORI benchmarks
      setupBenchmarkMock(
        {},
        {},
        { [SCORE_DATE]: 1500, '2021-06-01': 1620 }, // state ZORI
        { [SCORE_DATE]: 1400, '2021-06-01': 1484 }, // national ZORI
      );

      // Location rent data
      mockDataSource.getHistoricalData
        .mockResolvedValueOnce([{ date: SCORE_DATE, zori: 1600 }]) // start
        .mockResolvedValueOnce([{ date: '2021-06-01', zori: 1760 }]) // 1y
        .mockResolvedValueOnce(null); // 3y

      const outcome1y: OutcomeMetrics = { priceChange: 10 };
      const result = await service.calculateBenchmarkReturns(
        '31080',
        'metro',
        SCORE_DATE,
        STATE_CODE,
        outcome1y,
        undefined,
        undefined,
      );

      // Location rent return: (1760 - 1600) / 1600 = 10%
      expect(result.rentReturn1y).toBeCloseTo(10, 0);
      // State rent return: (1620 - 1500) / 1500 = 8%
      expect(result.stateRentReturn1y).toBeCloseTo(8, 0);
      // National rent return: (1484 - 1400) / 1400 = 6%
      expect(result.nationalRentReturn1y).toBeCloseTo(6, 0);
    });

    it('omits rent returns when location has no ZORI data', async () => {
      setupBenchmarkMock({}, {});
      mockDataSource.getHistoricalData.mockResolvedValue(null);

      const result = await service.calculateBenchmarkReturns(
        '31080',
        'metro',
        SCORE_DATE,
        STATE_CODE,
        undefined,
        undefined,
        undefined,
      );

      expect(result.rentReturn1y).toBeUndefined();
      expect(result.rentReturn3yCagr).toBeUndefined();
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('edge cases', () => {
    it('returns empty benchmarks when all data sources are null', async () => {
      // Default mock returns null for everything
      const result = await service.calculateBenchmarkReturns(
        '31080',
        'metro',
        SCORE_DATE,
        STATE_CODE,
        { priceChange: 10 },
        { priceCagr: 8 },
        { priceCagr: 7 },
      );

      // All benchmark fields should be undefined (empty object)
      expect(result.stateReturn1y).toBeUndefined();
      expect(result.nationalReturn1y).toBeUndefined();
      expect(result.stateReturn3yCagr).toBeUndefined();
      expect(result.nationalReturn3yCagr).toBeUndefined();
      expect(result.stateReturn5yCagr).toBeUndefined();
      expect(result.nationalReturn5yCagr).toBeUndefined();
    });

    it('handles null stateCode gracefully', async () => {
      setupBenchmarkMock({}, { [SCORE_DATE]: 350000, '2021-06-01': 371000 });

      const result = await service.calculateBenchmarkReturns(
        '31080',
        'metro',
        SCORE_DATE,
        null,
        { priceChange: 12 },
        undefined,
        undefined,
      );

      // National should still work, state should be undefined
      expect(result.nationalReturn1y).toBeDefined();
      expect(result.stateReturn1y).toBeUndefined();
    });

    it('handles undefined stateCode gracefully', async () => {
      setupBenchmarkMock({}, { [SCORE_DATE]: 350000, '2021-06-01': 371000 });

      const result = await service.calculateBenchmarkReturns(
        '31080',
        'metro',
        SCORE_DATE,
        undefined,
        { priceChange: 12 },
        undefined,
        undefined,
      );

      expect(result.nationalReturn1y).toBeDefined();
      expect(result.stateReturn1y).toBeUndefined();
    });
  });
});
