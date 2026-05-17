import { Test } from '@nestjs/testing';
import { MigrationService } from '../migration.service';
import { SupabaseService } from '../../supabase/supabase.service';

/**
 * Unit tests for `MigrationService.getTopInflows`.
 *
 * The method now reads from `irs_county_migration_flows` (origin_fips /
 * destination_fips / tax_year / num_returns) and joins `geographies` for
 * county names. Reserved IRS partner buckets (`00000`, `99999`) and the
 * "non-migrant" same-fips row are filtered in JS post-fetch — so the test
 * fixtures can include those rows and we assert they are dropped.
 */

interface MockRow {
  origin_fips?: string | null;
  num_returns?: number | null;
}

function buildClientMock(opts: {
  flowsRows?: MockRow[];
  geoRows?: Array<{ geography_id: string; name: string }>;
  flowsError?: { message: string } | null;
}): { from: jest.Mock; calls: { table: string }[] } {
  const calls: { table: string }[] = [];

  function makeFlowsChain() {
    const limit = jest.fn().mockResolvedValue({
      data: opts.flowsRows ?? [],
      error: opts.flowsError ?? null,
    });
    const order = jest.fn().mockReturnValue({ limit });
    const eqYear = jest.fn().mockReturnValue({ order });
    const eqDest = jest.fn().mockReturnValue({ eq: eqYear });
    const select = jest.fn().mockReturnValue({ eq: eqDest });
    return { select, _trace: { eqDest, eqYear, order, limit } };
  }

  function makeGeoChain() {
    const inFn = jest
      .fn()
      .mockResolvedValue({ data: opts.geoRows ?? [], error: null });
    const select = jest.fn().mockReturnValue({ in: inFn });
    return { select };
  }

  const from = jest.fn((table: string) => {
    calls.push({ table });
    if (table === 'irs_county_migration_flows') return makeFlowsChain();
    if (table === 'geographies') return makeGeoChain();
    throw new Error(`Unexpected table: ${table}`);
  });

  return { from, calls };
}

describe('MigrationService.getTopInflows', () => {
  let service: MigrationService;

  async function buildService(clientFromMock: jest.Mock) {
    const module = await Test.createTestingModule({
      providers: [
        MigrationService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: () => ({ from: clientFromMock }),
            from: clientFromMock,
          },
        },
      ],
    }).compile();
    service = module.get(MigrationService);
  }

  it('returns top-N inflow source counties with names from geographies join', async () => {
    const { from } = buildClientMock({
      flowsRows: [
        { origin_fips: '36061', num_returns: 1840 },
        { origin_fips: '11001', num_returns: 1210 },
      ],
      geoRows: [
        { geography_id: '36061', name: 'New York County, NY' },
        { geography_id: '11001', name: 'District of Columbia' },
      ],
    });
    await buildService(from);

    const result = await service.getTopInflows({
      countyFips: '37183',
      limit: 5,
      year: 2023,
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      fromCountyFips: '36061',
      fromName: 'New York County, NY',
      inflowCount: 1840,
    });
    expect(result[1].fromName).toBe('District of Columbia');
  });

  it('filters out same-fips non-migrant row and reserved 00000/99999 buckets', async () => {
    const { from } = buildClientMock({
      flowsRows: [
        // non-migrant stayer: same fips on both sides
        { origin_fips: '37183', num_returns: 437996 },
        // reserved IRS bucket
        { origin_fips: '00000', num_returns: 500 },
        { origin_fips: '99999', num_returns: 300 },
        // legitimate inflow
        { origin_fips: '36061', num_returns: 1840 },
      ],
      geoRows: [{ geography_id: '36061', name: 'New York County, NY' }],
    });
    await buildService(from);

    const result = await service.getTopInflows({
      countyFips: '37183',
      limit: 5,
      year: 2023,
    });

    expect(result).toHaveLength(1);
    expect(result[0].fromCountyFips).toBe('36061');
  });

  it('returns empty array when destination county has no migration data', async () => {
    const { from } = buildClientMock({ flowsRows: [], geoRows: [] });
    await buildService(from);

    const result = await service.getTopInflows({
      countyFips: '99999',
      limit: 5,
      year: 2023,
    });
    expect(result).toEqual([]);
  });

  it('returns empty array on supabase error', async () => {
    const { from } = buildClientMock({
      flowsError: { message: 'connection refused' },
    });
    await buildService(from);

    const result = await service.getTopInflows({
      countyFips: '37183',
      limit: 5,
      year: 2023,
    });
    expect(result).toEqual([]);
  });
});
