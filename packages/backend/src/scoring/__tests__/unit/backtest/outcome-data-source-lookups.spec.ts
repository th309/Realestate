/**
 * Outcome Data Source Service — Data Lookup Tests
 *
 * Tests the multi-source and benchmark data methods:
 * - getHistoricalData: Zillow → Redfin → Realtor fallback chain
 * - getBenchmarkData: state/national benchmark lookups
 */

import { Test, TestingModule } from '@nestjs/testing';
import { OutcomeDataSourceService } from '../../../backtest/outcome-data-source.service';
import { OutcomeCacheService } from '../../../backtest/outcome-cache.service';
import { OutcomeDbFallbackService } from '../../../backtest/outcome-db-fallback.service';
import { SupabaseService } from '../../../../supabase/supabase.service';

/** Creates a chainable mock that resolves to { data, error } at terminal call */
function createQueryChain(
  terminalResult: { data: any; error: any },
  terminalMethod: 'single' | 'resolve' = 'resolve',
) {
  const chain: Record<string, jest.Mock> = {};
  const chainMethods = ['select', 'eq', 'not', 'lte', 'order', 'limit'];

  for (const method of chainMethods) {
    chain[method] = jest.fn().mockReturnValue(chain);
  }

  if (terminalMethod === 'single') {
    chain['single'] = jest.fn().mockResolvedValue(terminalResult);
    chain['then'] = jest.fn((cb: any) =>
      Promise.resolve(terminalResult).then(cb),
    );
  } else {
    chain['then'] = jest.fn((cb: any) =>
      Promise.resolve(terminalResult).then(cb),
    );
    chain['single'] = jest.fn().mockResolvedValue(terminalResult);
  }

  return chain;
}

describe('OutcomeDataSourceService — Data Lookups', () => {
  let service: OutcomeDataSourceService;
  let mockFrom: jest.Mock;

  beforeEach(async () => {
    mockFrom = jest.fn();

    const mockSupabase = {
      getClient: jest.fn().mockReturnValue({ from: mockFrom }),
    } as unknown as jest.Mocked<SupabaseService>;

    // Mock cache: all lookups return undefined (not preloaded) to exercise DB fallback
    const mockCache = {
      lookupHistorical: jest.fn().mockReturnValue(undefined),
      lookupBenchmark: jest.fn().mockReturnValue(undefined),
      lookupRedfin: jest.fn().mockReturnValue(undefined),
      lookupRealtor: jest.fn().mockReturnValue(undefined),
      historicalCache: new Map(),
      benchmarkCache: new Map(),
      stateCodeCache: new Map(),
    } as unknown as jest.Mocked<OutcomeCacheService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutcomeDataSourceService,
        OutcomeDbFallbackService,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: OutcomeCacheService, useValue: mockCache },
      ],
    }).compile();

    service = module.get<OutcomeDataSourceService>(OutcomeDataSourceService);
  });

  // ==========================================================================
  // getHistoricalData — multi-source fallback
  // ==========================================================================

  describe('getHistoricalData', () => {
    it('returns Zillow data when available (primary source)', async () => {
      const zillowChain = createQueryChain({
        data: [{ period_date: '2021-06-01', value: 350000 }],
        error: null,
      });
      mockFrom.mockReturnValue(zillowChain);

      const result = await service.getHistoricalData(
        '31080',
        'metro',
        '2021-06-01',
      );

      expect(result).toEqual([
        { date: '2021-06-01', zhvi: 350000, source: 'zillow' },
      ]);
      expect(mockFrom).toHaveBeenCalledWith('zillow_metro');
    });

    it('falls back to Redfin when Zillow returns no data', async () => {
      const zillowChain = createQueryChain({ data: [], error: null });
      const redfinChain = createQueryChain({
        data: [{ period_end: '2021-06-01', median_sale_price: 340000 }],
        error: null,
      });

      mockFrom
        .mockReturnValueOnce(zillowChain) // Zillow
        .mockReturnValueOnce(redfinChain); // Redfin

      const result = await service.getHistoricalData(
        '31080',
        'metro',
        '2021-06-01',
      );

      expect(result).toEqual([
        { date: '2021-06-01', zhvi: 340000, source: 'redfin' },
      ]);
      expect(mockFrom).toHaveBeenCalledWith('zillow_metro');
      expect(mockFrom).toHaveBeenCalledWith('redfin_metro');
    });

    it('falls back to Realtor when Zillow and Redfin have no data', async () => {
      const zillowChain = createQueryChain({ data: [], error: null });
      const redfinChain = createQueryChain({ data: [], error: null });
      const realtorChain = createQueryChain({
        data: [{ period_date: '2021-06-01', median_listing_price: 360000 }],
        error: null,
      });

      mockFrom
        .mockReturnValueOnce(zillowChain)
        .mockReturnValueOnce(redfinChain)
        .mockReturnValueOnce(realtorChain);

      const result = await service.getHistoricalData(
        '31080',
        'metro',
        '2021-06-01',
      );

      expect(result).toEqual([
        { date: '2021-06-01', zhvi: 360000, source: 'realtor' },
      ]);
      expect(mockFrom).toHaveBeenCalledWith('realtor_metro');
    });

    it('returns null when all sources have no data', async () => {
      const emptyChain = createQueryChain({ data: [], error: null });

      mockFrom
        .mockReturnValueOnce(emptyChain) // Zillow
        .mockReturnValueOnce(emptyChain) // Redfin
        .mockReturnValueOnce(emptyChain); // Realtor

      const result = await service.getHistoricalData(
        '31080',
        'metro',
        '2021-06-01',
      );

      expect(result).toBeNull();
    });

    it('skips Redfin fallback when no Redfin route exists (state)', async () => {
      const zillowChain = createQueryChain({ data: [], error: null });

      mockFrom.mockReturnValueOnce(zillowChain);

      const result = await service.getHistoricalData(
        'CA',
        'state',
        '2021-06-01',
      );

      expect(result).toBeNull();
      expect(mockFrom).toHaveBeenCalledWith('zillow_state');
      expect(mockFrom).toHaveBeenCalledTimes(1);
    });

    it('skips Redfin data row when median_sale_price is null', async () => {
      const zillowChain = createQueryChain({ data: [], error: null });
      const redfinChain = createQueryChain({
        data: [{ period_end: '2021-06-01', median_sale_price: null }],
        error: null,
      });
      const realtorChain = createQueryChain({
        data: [{ period_date: '2021-06-01', median_listing_price: 360000 }],
        error: null,
      });

      mockFrom
        .mockReturnValueOnce(zillowChain)
        .mockReturnValueOnce(redfinChain)
        .mockReturnValueOnce(realtorChain);

      const result = await service.getHistoricalData(
        '31080',
        'metro',
        '2021-06-01',
      );

      expect(result).toEqual([
        { date: '2021-06-01', zhvi: 360000, source: 'realtor' },
      ]);
    });

    it('uses correct Redfin property_type filter', async () => {
      const zillowChain = createQueryChain({ data: [], error: null });
      const redfinChain = createQueryChain({
        data: [{ period_end: '2021-06-01', median_sale_price: 340000 }],
        error: null,
      });

      mockFrom
        .mockReturnValueOnce(zillowChain)
        .mockReturnValueOnce(redfinChain);

      await service.getHistoricalData('31080', 'metro', '2021-06-01');

      expect(redfinChain.eq).toHaveBeenCalledWith(
        'property_type',
        'All Residential',
      );
    });
  });

  // ==========================================================================
  // getBenchmarkData
  // ==========================================================================

  describe('getBenchmarkData', () => {
    it('returns ZHVI for national benchmark', async () => {
      const chain = createQueryChain({
        data: [{ value: 350000 }],
        error: null,
      });
      mockFrom.mockReturnValue(chain);

      const result = await service.getBenchmarkData(
        'national',
        null,
        '2021-06-01',
        'zhvi',
      );

      expect(result).toEqual({ zhvi: 350000 });
      expect(mockFrom).toHaveBeenCalledWith('zillow_state');
      expect(chain.eq).toHaveBeenCalledWith('region_name', 'United States');
      expect(chain.eq).toHaveBeenCalledWith('metric_name', 'zhvi');
    });

    it('returns ZORI for national benchmark', async () => {
      const chain = createQueryChain({
        data: [{ value: 1800 }],
        error: null,
      });
      mockFrom.mockReturnValue(chain);

      const result = await service.getBenchmarkData(
        'national',
        null,
        '2021-06-01',
        'zori',
      );

      expect(result).toEqual({ zori: 1800 });
    });

    it('returns ZHVI for state benchmark', async () => {
      const chain = createQueryChain({
        data: [{ value: 400000 }],
        error: null,
      });
      mockFrom.mockReturnValue(chain);

      const result = await service.getBenchmarkData(
        'state',
        'CA',
        '2021-06-01',
        'zhvi',
      );

      expect(result).toEqual({ zhvi: 400000 });
      expect(chain.eq).toHaveBeenCalledWith('state_code', 'CA');
    });

    it('returns null when stateCode is null for state level', async () => {
      const result = await service.getBenchmarkData(
        'state',
        null,
        '2021-06-01',
        'zhvi',
      );

      expect(result).toBeNull();
    });

    it('returns null when no data found', async () => {
      const chain = createQueryChain({ data: [], error: null });
      mockFrom.mockReturnValue(chain);

      const result = await service.getBenchmarkData(
        'national',
        null,
        '2021-06-01',
        'zhvi',
      );

      expect(result).toBeNull();
    });

    it('returns null on Supabase error', async () => {
      const chain = createQueryChain({
        data: null,
        error: { message: 'DB error' },
      });
      mockFrom.mockReturnValue(chain);

      const result = await service.getBenchmarkData(
        'national',
        null,
        '2021-06-01',
        'zhvi',
      );

      expect(result).toBeNull();
    });

    it('defaults to zhvi metric when none specified', async () => {
      const chain = createQueryChain({
        data: [{ value: 350000 }],
        error: null,
      });
      mockFrom.mockReturnValue(chain);

      const result = await service.getBenchmarkData(
        'national',
        null,
        '2021-06-01',
      );

      expect(result).toEqual({ zhvi: 350000 });
      expect(chain.eq).toHaveBeenCalledWith('metric_name', 'zhvi');
    });
  });
});
