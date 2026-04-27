import { BadRequestException } from '@nestjs/common';
import {
  RankingResolverService,
  ResolveRankingInput,
  MIN_RANKINGS,
} from './ranking-resolver.service';
import { SourceFetcherBulkService } from '../../metric-resolution/source-fetcher-bulk.service';
import { SupabaseService } from '../../supabase/supabase.service';

// Mock the query helpers so tests don't need a live Supabase chain mock.
jest.mock('./ranking-queries', () => {
  const actual = jest.requireActual('./ranking-queries');
  return {
    ...actual,
    resolveScopeRegionIds: jest.fn(),
    fetchPiqRankings: jest.fn(),
  };
});
import {
  resolveScopeRegionIds,
  fetchPiqRankings,
  parseLocationName,
} from './ranking-queries';

const mockedResolveScope = resolveScopeRegionIds as jest.MockedFunction<
  typeof resolveScopeRegionIds
>;
const mockedFetchPiq = fetchPiqRankings as jest.MockedFunction<
  typeof fetchPiqRankings
>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeService(opts?: {
  bulkRowsBySource?: Record<string, Array<unknown>>;
}): {
  service: RankingResolverService;
  bulkSpy: jest.Mock;
} {
  const bulkRowsBySource = opts?.bulkRowsBySource ?? {};
  const bulkSpy = jest
    .fn()
    .mockImplementation((source: string) => bulkRowsBySource[source] ?? []);
  const sourceFetcherBulk = {
    fetchLatestForAllRegions: bulkSpy,
  } as unknown as SourceFetcherBulkService;

  const supabase = {
    getClient: jest.fn().mockReturnValue({}),
  } as unknown as SupabaseService;

  const service = new RankingResolverService(sourceFetcherBulk, supabase);
  return { service, bulkSpy };
}

function makeBulkRows(count: number, valueBase = 500_000) {
  return Array.from({ length: count }, (_, i) => ({
    regionId: String(35000 + i),
    regionName: `Metro ${i}, CA`,
    value: valueBase - i * 1000,
    date: '2026-03-01',
  }));
}

function makePiqRows(count: number, scoreBase = 90) {
  return Array.from({ length: count }, (_, i) => ({
    location_id: String(35000 + i),
    location_name: `Metro ${i}, CA`,
    score: scoreBase - i,
    score_date: '2026-03-01',
  }));
}

const baseInput: ResolveRankingInput = {
  format: 'top_10_ranking',
  metric_id: 'home_value',
  geo_level: 'metro',
  scope_type: 'national',
  scope_id: null,
};

beforeEach(() => {
  mockedResolveScope.mockReset();
  mockedFetchPiq.mockReset();
  mockedResolveScope.mockResolvedValue(null); // national by default
});

// ---------------------------------------------------------------------------
// PIQ path
// ---------------------------------------------------------------------------

describe('resolve(propertyiq_score) — PIQ path', () => {
  it('returns 10 ranked entries, parsing state from location_name', async () => {
    mockedFetchPiq.mockResolvedValue(makePiqRows(10));
    const { service } = makeService();

    const result = await service.resolve({
      ...baseInput,
      metric_id: 'propertyiq_score',
    });

    expect(result.insufficient_data).toBe(false);
    expect(result.rankings).toHaveLength(10);
    expect(result.metric.id).toBe('propertyiq_score');
    expect(result.metric.label).toBe('PropertyIQ Score');
    expect(result.metric.format).toBe('index');
    expect(result.rankings[0].rank).toBe(1);
    expect(result.rankings[0].region_name).toBe('Metro 0');
    expect(result.rankings[0].state).toBe('CA');
    expect(result.as_of).toBe('2026-03-01');
  });

  it('passes ascending=true and limit through to fetchPiqRankings for bottom_10', async () => {
    mockedFetchPiq.mockResolvedValue(makePiqRows(10, 30));
    const { service } = makeService();

    await service.resolve({
      ...baseInput,
      format: 'bottom_10_ranking',
      metric_id: 'propertyiq_score',
      limit: 5,
    });

    expect(mockedFetchPiq).toHaveBeenCalledWith(
      expect.anything(),
      'metro',
      null,
      true, // ascending
      5,
    );
  });

  it('passes scope region IDs to fetchPiqRankings for state scope', async () => {
    mockedResolveScope.mockResolvedValue(['35620', '12060']);
    mockedFetchPiq.mockResolvedValue(makePiqRows(10));
    const { service } = makeService();

    await service.resolve({
      ...baseInput,
      metric_id: 'propertyiq_score',
      scope_type: 'state',
      scope_id: 'CA',
    });

    expect(mockedFetchPiq).toHaveBeenCalledWith(
      expect.anything(),
      'metro',
      ['35620', '12060'],
      false,
      10,
    );
  });

  it('returns insufficient_data when fewer than MIN_RANKINGS rows', async () => {
    mockedFetchPiq.mockResolvedValue(makePiqRows(3));
    const { service } = makeService();

    const result = await service.resolve({
      ...baseInput,
      metric_id: 'propertyiq_score',
    });

    expect(result.insufficient_data).toBe(true);
    expect(result.rankings).toHaveLength(0);
    expect(result.eligible_count).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Raw metric path
// ---------------------------------------------------------------------------

describe('resolve(home_value) — raw-metric happy path', () => {
  it('returns 10 ranked entries from the canonical bulk fetcher', async () => {
    const { service, bulkSpy } = makeService({
      bulkRowsBySource: { zillow: makeBulkRows(10) },
    });

    const result = await service.resolve(baseInput);

    expect(result.insufficient_data).toBe(false);
    expect(result.rankings).toHaveLength(10);
    expect(result.metric.id).toBe('home_value');
    expect(result.metric.format).toBe('currency');
    expect(result.rankings[0].rank).toBe(1);
    expect(result.rankings[0].region_name).toBe('Metro 0');
    expect(result.rankings[0].state).toBe('CA');
    expect(result.rankings[0].value_formatted).toMatch(/^\$/);
    // Used the canonical bulk fetcher with the FALLBACK_REGISTRY primary source
    expect(bulkSpy).toHaveBeenCalledWith('zillow', 'zhvi', 'metro');
  });

  it('sorts ascending for bottom_10_ranking', async () => {
    const { service } = makeService({
      bulkRowsBySource: { zillow: makeBulkRows(10) },
    });

    const result = await service.resolve({
      ...baseInput,
      format: 'bottom_10_ranking',
    });

    // Bulk fetcher returns desc; service must re-sort asc for bottom_10.
    expect(result.direction).toBe('bottom');
    const values = result.rankings.map((r) => r.value);
    const sortedAsc = [...values].sort((a, b) => a - b);
    expect(values).toEqual(sortedAsc);
  });

  it('falls back to second source if first returns empty', async () => {
    const { service, bulkSpy } = makeService({
      bulkRowsBySource: {
        zillow: [],
        redfin: makeBulkRows(10, 600_000),
      },
    });

    const result = await service.resolve(baseInput);

    expect(result.rankings).toHaveLength(10);
    expect(bulkSpy).toHaveBeenNthCalledWith(1, 'zillow', 'zhvi', 'metro');
    expect(bulkSpy).toHaveBeenNthCalledWith(
      2,
      'redfin',
      'median_sale_price',
      'metro',
    );
  });
});

describe('resolve(home_value_yoy) — applies fallback chain transform', () => {
  it('multiplies decimal value by 100 (toPercent) before sorting', async () => {
    // home_value_yoy chain: realtor.median_listing_price_yy with toPercent transform
    const decimalRows = [
      {
        regionId: '35620',
        regionName: 'NYC, NY',
        value: 0.05,
        date: '2026-03-01',
      },
      ...Array.from({ length: 9 }, (_, i) => ({
        regionId: String(10000 + i),
        regionName: `Metro ${i}, CA`,
        value: 0.01 + i * 0.005,
        date: '2026-03-01',
      })),
    ];
    const { service } = makeService({
      bulkRowsBySource: { realtor: decimalRows },
    });

    const result = await service.resolve({
      ...baseInput,
      metric_id: 'home_value_yoy',
    });

    expect(result.rankings).toHaveLength(10);
    // 0.05 * 100 = 5
    expect(result.rankings[0].value).toBe(5);
    expect(result.metric.format).toBe('percent');
  });
});

describe('resolve filters by scope when scope_type !== national', () => {
  it('keeps only rows whose regionId is in the crosswalk-resolved scope set', async () => {
    mockedResolveScope.mockResolvedValue(['35001', '35003']);
    const { service } = makeService({
      bulkRowsBySource: { zillow: makeBulkRows(10) },
    });

    const result = await service.resolve({
      ...baseInput,
      scope_type: 'state',
      scope_id: 'CA',
    });

    // makeBulkRows uses regionId 35000..35009 — only 35001, 35003 in scope.
    // Falls below MIN_RANKINGS so insufficient_data trips.
    expect(result.eligible_count).toBe(2);
    expect(result.insufficient_data).toBe(true);
  });
});

describe('resolve(unknown_metric) — error handling', () => {
  it('throws BadRequestException when metric not in FALLBACK_REGISTRY', async () => {
    const { service } = makeService();
    await expect(
      service.resolve({ ...baseInput, metric_id: 'totally_made_up_metric' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

// ---------------------------------------------------------------------------
// parseLocationName (used by both paths)
// ---------------------------------------------------------------------------

describe('parseLocationName', () => {
  it('splits "Austin, TX" into name + state', () => {
    expect(parseLocationName('Austin, TX')).toEqual({
      name: 'Austin',
      state: 'TX',
    });
  });

  it('splits hyphenated metro names', () => {
    expect(parseLocationName('Houston-The Woodlands-Sugar Land, TX')).toEqual({
      name: 'Houston-The Woodlands-Sugar Land',
      state: 'TX',
    });
  });

  it('strips " metro area" suffix used by 922/935 propertyiq_scores rows', () => {
    expect(parseLocationName('San Jose, CA metro area')).toEqual({
      name: 'San Jose',
      state: 'CA',
    });
    expect(parseLocationName('North Platte, NE metro area')).toEqual({
      name: 'North Platte',
      state: 'NE',
    });
  });

  it('strips " statistical area" suffix', () => {
    expect(parseLocationName('Foo, NY statistical area')).toEqual({
      name: 'Foo',
      state: 'NY',
    });
  });

  it('strips trailing parenthetical clause', () => {
    expect(parseLocationName('Honolulu, HI (Urban Honolulu)')).toEqual({
      name: 'Honolulu',
      state: 'HI',
    });
  });

  it('returns null state when name has no comma+state suffix', () => {
    expect(parseLocationName('90210')).toEqual({
      name: '90210',
      state: null,
    });
  });
});
