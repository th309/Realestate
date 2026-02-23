/**
 * RankingsCacheService Tests
 *
 * Tests the rankings cache pipeline: metric resolution for all geographies,
 * sorting into top/bottom rankings, formatting, and database storage.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { RankingsCacheService } from './rankings-cache.service';
import { MetricResolutionService } from '../metric-resolution/metric-resolution.service';
import { SupabaseService } from '../supabase/supabase.service';
import { ResolvedMetric } from '../metric-resolution/metric-resolution.types';

// -- Test Helpers -----------------------------------------------------------

function makeResolved(value: number | null): ResolvedMetric {
  return {
    value, date: '2026-01-15', source: 'zillow',
    sourceGeoId: null, sourceGeoLevel: 'metro',
    isInherited: false, isFallback: false,
  };
}

function buildMap(entries: Array<[string, number | null]>): Map<string, ResolvedMetric> {
  return new Map(entries.map(([id, val]) => [id, makeResolved(val)]));
}

// -- Tracking Mock Supabase -------------------------------------------------

/** Creates a mock Supabase client that tracks all update/insert payloads */
function createTrackingClient(geoNames: Record<string, string> = {}) {
  const tracked = { updates: [] as any[], inserts: [] as any[] };

  const geoRows = Object.entries(geoNames).map(([id, name]) => ({ geography_id: id, name }));

  /** Build a chainable .eq()... chain that resolves at the end */
  const eqChain = (depth: number, resolveWith: any): any => {
    if (depth <= 0) return jest.fn().mockResolvedValue(resolveWith);
    return jest.fn().mockReturnValue({ eq: eqChain(depth - 1, resolveWith) });
  };

  const from = jest.fn().mockImplementation((table: string) => {
    if (table === 'geographies') {
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue({ data: geoRows, error: null }),
          }),
        }),
      };
    }
    // rankings_cache table
    return {
      update: jest.fn().mockImplementation((payload: any) => {
        tracked.updates.push(payload);
        return { eq: eqChain(3, { data: null, error: null }) };
      }),
      insert: jest.fn().mockImplementation((payload: any) => {
        tracked.inserts.push(payload);
        return Promise.resolve({ data: null, error: null });
      }),
      select: jest.fn().mockReturnValue({
        eq: eqChain(3, {
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    };
  });

  return { from, tracked };
}

// -- Test Suite -------------------------------------------------------------

describe('RankingsCacheService', () => {
  let service: RankingsCacheService;
  let mockResolution: jest.Mocked<MetricResolutionService>;
  let client: ReturnType<typeof createTrackingClient>;

  function setup(geoNames: Record<string, string> = {}) {
    client = createTrackingClient(geoNames);
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    client = createTrackingClient();

    mockResolution = {
      resolveMetric: jest.fn(),
      resolveMetricBatch: jest.fn(),
      resolveMetricForAllGeos: jest.fn().mockResolvedValue(new Map()),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RankingsCacheService,
        { provide: MetricResolutionService, useValue: mockResolution },
        { provide: SupabaseService, useValue: { getClient: () => client } },
      ],
    }).compile();

    service = module.get<RankingsCacheService>(RankingsCacheService);
  });

  // =========================================================================
  // refreshAll
  // =========================================================================

  describe('refreshAll processes all metrics x all geo levels', () => {
    it('calls refreshMetric for every metric and geo combination', async () => {
      const spy = jest.spyOn(service, 'refreshMetric').mockResolvedValue();
      const result = await service.refreshAll();
      // 12 metrics x 3 geo levels = 36 combinations
      expect(spy.mock.calls.length).toBe(36);
      expect(result).toEqual({ succeeded: 36, failed: 0 });
    });

    it('counts failures without aborting the rest', async () => {
      const spy = jest.spyOn(service, 'refreshMetric');
      spy.mockRejectedValueOnce(new Error('DB timeout'));
      spy.mockResolvedValue();
      const result = await service.refreshAll();
      expect(result).toEqual({ succeeded: 35, failed: 1 });
    });
  });

  // =========================================================================
  // refreshMetric — sorting and storage
  // =========================================================================

  describe('refreshMetric fetches, sorts, and stores rankings', () => {
    it('calls resolveMetricForAllGeos with correct args', async () => {
      setup({ '31080': 'LA', '12060': 'ATL' });
      mockResolution.resolveMetricForAllGeos.mockResolvedValue(
        buildMap([['31080', 500000], ['12060', 400000]]),
      );
      await service.refreshMetric('home_value', 'metro');
      expect(mockResolution.resolveMetricForAllGeos).toHaveBeenCalledWith('home_value', 'metro');
    });

    it('sorts top rankings descending by value', async () => {
      setup({ A: 'RA', B: 'RB', C: 'RC' });
      mockResolution.resolveMetricForAllGeos.mockResolvedValue(
        buildMap([['A', 100], ['B', 300], ['C', 200]]),
      );
      await service.refreshMetric('home_value', 'metro');

      const top = client.tracked.inserts.find((i: any) => i.direction === 'top');
      expect(top.rankings.map((r: any) => r.value)).toEqual([300, 200, 100]);
    });

    it('sorts bottom rankings ascending by value', async () => {
      setup({ A: 'RA', B: 'RB', C: 'RC' });
      mockResolution.resolveMetricForAllGeos.mockResolvedValue(
        buildMap([['A', 100], ['B', 300], ['C', 200]]),
      );
      await service.refreshMetric('home_value', 'metro');

      const bottom = client.tracked.inserts.find((i: any) => i.direction === 'bottom');
      expect(bottom.rankings.map((r: any) => r.value)).toEqual([100, 200, 300]);
    });

    it('assigns correct rank numbers starting at 1', async () => {
      setup({ A: 'RA', B: 'RB', C: 'RC' });
      mockResolution.resolveMetricForAllGeos.mockResolvedValue(
        buildMap([['A', 50], ['B', 90], ['C', 70]]),
      );
      await service.refreshMetric('home_value', 'metro');

      const top = client.tracked.inserts.find((i: any) => i.direction === 'top');
      expect(top.rankings.map((r: any) => r.rank)).toEqual([1, 2, 3]);
    });

    it('includes geography_name from geographies table', async () => {
      setup({ '31080': 'Los Angeles' });
      mockResolution.resolveMetricForAllGeos.mockResolvedValue(buildMap([['31080', 500000]]));
      await service.refreshMetric('home_value', 'metro');

      const top = client.tracked.inserts.find((i: any) => i.direction === 'top');
      expect(top.rankings[0].geography_name).toBe('Los Angeles');
    });

    it('includes formatted value in ranking entries', async () => {
      setup({ '31080': 'LA' });
      mockResolution.resolveMetricForAllGeos.mockResolvedValue(buildMap([['31080', 500000]]));
      await service.refreshMetric('home_value', 'metro');

      const top = client.tracked.inserts.find((i: any) => i.direction === 'top');
      expect(top.rankings[0].formatted).toBe('$500,000');
    });
  });

  // =========================================================================
  // is_latest flag management
  // =========================================================================

  describe('is_latest set to false before inserting new', () => {
    it('marks previous entries as not latest before insert', async () => {
      setup({ A: 'RA' });
      mockResolution.resolveMetricForAllGeos.mockResolvedValue(buildMap([['A', 100]]));
      await service.refreshMetric('home_value', 'metro');

      // 2 updates: one for top, one for bottom
      expect(client.tracked.updates.length).toBe(2);
      expect(client.tracked.updates[0]).toEqual({ is_latest: false });
      expect(client.tracked.updates[1]).toEqual({ is_latest: false });
    });
  });

  // =========================================================================
  // Edge cases
  // =========================================================================

  describe('handles edge cases correctly', () => {
    it('returns all entries when fewer than 10 exist', async () => {
      setup({ A: 'RA', B: 'RB', C: 'RC' });
      mockResolution.resolveMetricForAllGeos.mockResolvedValue(
        buildMap([['A', 100], ['B', 200], ['C', 300]]),
      );
      await service.refreshMetric('home_value', 'metro');

      const top = client.tracked.inserts.find((i: any) => i.direction === 'top');
      expect(top.rank_count).toBe(3);
      expect(top.rankings.length).toBe(3);
    });

    it('stores empty rankings when all values are null', async () => {
      setup({ A: 'RA', B: 'RB' });
      mockResolution.resolveMetricForAllGeos.mockResolvedValue(
        buildMap([['A', null], ['B', null]]),
      );
      await service.refreshMetric('home_value', 'metro');

      const top = client.tracked.inserts.find((i: any) => i.direction === 'top');
      expect(top.rank_count).toBe(0);
      expect(top.rankings).toEqual([]);
    });

    it('stores empty rankings when resolved map is empty', async () => {
      setup();
      mockResolution.resolveMetricForAllGeos.mockResolvedValue(new Map());
      await service.refreshMetric('home_value', 'metro');

      const top = client.tracked.inserts.find((i: any) => i.direction === 'top');
      expect(top.rank_count).toBe(0);
    });

    it('excludes null values from rankings', async () => {
      setup({ A: 'RA', B: 'RB', C: 'RC', D: 'RD', E: 'RE' });
      mockResolution.resolveMetricForAllGeos.mockResolvedValue(
        buildMap([['A', 500], ['B', null], ['C', 300], ['D', null], ['E', 100]]),
      );
      await service.refreshMetric('home_value', 'metro');

      const top = client.tracked.inserts.find((i: any) => i.direction === 'top');
      expect(top.rank_count).toBe(3);
      const ids = top.rankings.map((r: any) => r.geography_id);
      expect(ids).not.toContain('B');
      expect(ids).not.toContain('D');
    });

    it('caps rankings at 10 when more geographies exist', async () => {
      const geoNames: Record<string, string> = {};
      const entries: Array<[string, number]> = [];
      for (let i = 0; i < 15; i++) {
        const id = `GEO_${i}`;
        geoNames[id] = `Region ${id}`;
        entries.push([id, (i + 1) * 100]);
      }
      setup(geoNames);
      mockResolution.resolveMetricForAllGeos.mockResolvedValue(buildMap(entries));
      await service.refreshMetric('home_value', 'metro');

      const top = client.tracked.inserts.find((i: any) => i.direction === 'top');
      expect(top.rank_count).toBe(10);
      expect(top.rankings[0].value).toBe(1500);
      expect(top.rankings[9].value).toBe(600);
    });
  });

  // =========================================================================
  // getRanking
  // =========================================================================

  describe('getRanking retrieves cached ranking from database', () => {
    it('returns rankings array when data exists', async () => {
      const expected = [
        { geography_id: '31080', geography_name: 'LA', value: 500000, formatted: '$500,000', rank: 1 },
      ];
      // Override the client for getRanking's select chain
      const eqChain = (depth: number, resolveWith: any): any => {
        if (depth <= 0) return resolveWith;
        return { eq: jest.fn().mockReturnValue(eqChain(depth - 1, resolveWith)) };
      };
      client.from.mockReturnValue({
        select: jest.fn().mockReturnValue(
          eqChain(4, { single: jest.fn().mockResolvedValue({ data: { rankings: expected }, error: null }) }),
        ),
      } as any);

      const result = await service.getRanking('home_value', 'metro', 'top');
      expect(result).toEqual(expected);
    });

    it('returns null when no cached data exists', async () => {
      const eqChain = (depth: number, resolveWith: any): any => {
        if (depth <= 0) return resolveWith;
        return { eq: jest.fn().mockReturnValue(eqChain(depth - 1, resolveWith)) };
      };
      client.from.mockReturnValue({
        select: jest.fn().mockReturnValue(
          eqChain(4, { single: jest.fn().mockResolvedValue({ data: null, error: null }) }),
        ),
      } as any);

      expect(await service.getRanking('home_value', 'metro', 'top')).toBeNull();
    });
  });

  // =========================================================================
  // Value formatting
  // =========================================================================

  describe('formatValue produces correct format per metric type', () => {
    async function getFormattedValue(metricId: string, value: number): Promise<string> {
      setup({ A: 'RA' });
      mockResolution.resolveMetricForAllGeos.mockResolvedValue(buildMap([['A', value]]));
      client.tracked.inserts = []; // reset
      await service.refreshMetric(metricId, 'metro');
      const top = client.tracked.inserts.find((i: any) => i.direction === 'top');
      return top.rankings[0].formatted;
    }

    it('formats currency metrics with dollar sign and commas', async () => {
      expect(await getFormattedValue('home_value', 1234567)).toBe('$1,234,567');
    });

    it('formats percent metrics with % suffix', async () => {
      expect(await getFormattedValue('appreciation_yoy', 4.25)).toBe('4.25%');
    });

    it('formats days metrics with " days" suffix', async () => {
      expect(await getFormattedValue('dom', 28)).toBe('28 days');
    });

    it('formats ratio metrics with x suffix', async () => {
      expect(await getFormattedValue('price_to_rent', 20.83)).toBe('20.8x');
    });

    it('formats inventory as plain number with commas', async () => {
      expect(await getFormattedValue('inventory', 15000)).toBe('15,000');
    });
  });
});
