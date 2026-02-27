/**
 * Outcome Data Source Service — Score & State Query Tests
 *
 * Tests the simpler single-table query methods:
 * - getHistoricalScore: v2 schema score lookup
 * - getGeographiesWithScores: paginated geography discovery
 * - getStateCode: geography-to-state resolution
 */

import { Test, TestingModule } from '@nestjs/testing';
import { OutcomeDataSourceService } from '../../../backtest/outcome-data-source.service';
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

describe('OutcomeDataSourceService — Score & State Queries', () => {
  let service: OutcomeDataSourceService;
  let mockFrom: jest.Mock;

  beforeEach(async () => {
    mockFrom = jest.fn();

    const mockSupabase = {
      getClient: jest.fn().mockReturnValue({ from: mockFrom }),
    } as unknown as jest.Mocked<SupabaseService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutcomeDataSourceService,
        { provide: SupabaseService, useValue: mockSupabase },
      ],
    }).compile();

    service = module.get<OutcomeDataSourceService>(OutcomeDataSourceService);
  });

  // ==========================================================================
  // getHistoricalScore
  // ==========================================================================

  describe('getHistoricalScore', () => {
    it('returns score value when found', async () => {
      const chain = createQueryChain(
        { data: { score: 78 }, error: null },
        'single',
      );
      mockFrom.mockReturnValue(chain);

      const result = await service.getHistoricalScore(
        '31080',
        'metro',
        'homeready',
        '2021-06-01',
      );

      expect(result).toBe(78);
      expect(mockFrom).toHaveBeenCalledWith('propertyiq_scores');
      expect(chain.select).toHaveBeenCalledWith('score');
      expect(chain.eq).toHaveBeenCalledWith('location_id', '31080');
      expect(chain.eq).toHaveBeenCalledWith('geography', 'metro');
      expect(chain.eq).toHaveBeenCalledWith('score_type', 'homeready');
      expect(chain.eq).toHaveBeenCalledWith('score_date', '2021-06-01');
    });

    it('returns null when no data found', async () => {
      const chain = createQueryChain({ data: null, error: null }, 'single');
      mockFrom.mockReturnValue(chain);

      const result = await service.getHistoricalScore(
        '31080',
        'metro',
        'homeready',
        '2021-06-01',
      );

      expect(result).toBeNull();
    });

    it('returns null on Supabase error', async () => {
      const chain = createQueryChain(
        { data: null, error: { message: 'DB error' } },
        'single',
      );
      mockFrom.mockReturnValue(chain);

      const result = await service.getHistoricalScore(
        '31080',
        'metro',
        'homeready',
        '2021-06-01',
      );

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // getGeographiesWithScores
  // ==========================================================================

  describe('getGeographiesWithScores', () => {
    it('returns mapped geography IDs', async () => {
      const chain = createQueryChain({
        data: [{ location_id: '31080' }, { location_id: '35620' }],
        error: null,
      });
      mockFrom.mockReturnValue(chain);

      const result = await service.getGeographiesWithScores(
        'metro',
        'homeready',
        '2021-06-01',
        100,
      );

      expect(result).toEqual([{ id: '31080' }, { id: '35620' }]);
      expect(mockFrom).toHaveBeenCalledWith('propertyiq_scores');
      expect(chain.eq).toHaveBeenCalledWith('geography', 'metro');
      expect(chain.eq).toHaveBeenCalledWith('score_type', 'homeready');
      expect(chain.eq).toHaveBeenCalledWith('score_date', '2021-06-01');
    });

    it('returns empty array on error', async () => {
      const chain = createQueryChain({
        data: null,
        error: { message: 'DB error' },
      });
      mockFrom.mockReturnValue(chain);

      const result = await service.getGeographiesWithScores(
        'metro',
        'homeready',
        '2021-06-01',
        100,
      );

      expect(result).toEqual([]);
    });

    it('returns empty array when no data', async () => {
      const chain = createQueryChain({ data: null, error: null });
      mockFrom.mockReturnValue(chain);

      const result = await service.getGeographiesWithScores(
        'metro',
        'homeready',
        '2021-06-01',
        100,
      );

      expect(result).toEqual([]);
    });
  });

  // ==========================================================================
  // getStateCode
  // ==========================================================================

  describe('getStateCode', () => {
    it('returns state_code for metro via zillow_metro', async () => {
      const chain = createQueryChain(
        { data: { state_code: 'CA' }, error: null },
        'single',
      );
      mockFrom.mockReturnValue(chain);

      const result = await service.getStateCode('31080', 'metro');

      expect(result).toBe('CA');
      expect(mockFrom).toHaveBeenCalledWith('zillow_metro');
      expect(chain.eq).toHaveBeenCalledWith('cbsa_code', '31080');
    });

    it('returns state_code for county via zillow_county', async () => {
      const chain = createQueryChain(
        { data: { state_code: 'TX' }, error: null },
        'single',
      );
      mockFrom.mockReturnValue(chain);

      const result = await service.getStateCode('48201', 'county');

      expect(result).toBe('TX');
      expect(mockFrom).toHaveBeenCalledWith('zillow_county');
      expect(chain.eq).toHaveBeenCalledWith('fips_code', '48201');
    });

    it('returns state_code for zip via zillow_zip', async () => {
      const chain = createQueryChain(
        { data: { state_code: 'NY' }, error: null },
        'single',
      );
      mockFrom.mockReturnValue(chain);

      const result = await service.getStateCode('10001', 'zip');

      expect(result).toBe('NY');
      expect(mockFrom).toHaveBeenCalledWith('zillow_zip');
      expect(chain.eq).toHaveBeenCalledWith('region_name', '10001');
    });

    it('returns null for unknown geography type', async () => {
      const result = await service.getStateCode('X', 'state');
      expect(result).toBeNull();
    });

    it('returns null when Supabase returns no data', async () => {
      const chain = createQueryChain({ data: null, error: null }, 'single');
      mockFrom.mockReturnValue(chain);

      const result = await service.getStateCode('99999', 'metro');
      expect(result).toBeNull();
    });
  });
});
