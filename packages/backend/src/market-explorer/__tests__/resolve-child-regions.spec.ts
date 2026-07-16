import {
  resolveChildRegions,
  resolveChildRegionsWithCount,
  snapshotRoster,
  ZIP_FETCH_CAP,
} from '../resolve-child-regions';

/** Minimal thenable + range()/count-aware Supabase query-builder mock. */
function makeSupabase(handlers: {
  crosswalk?: (col: string, val: string) => any[];
  snapshot?: (ids: string[]) => any[];
  topMetroPages?: any[][]; // one array of rows per page, consumed in order
  countResult?: number;
}) {
  let pageCalls = 0;
  return {
    from(table: string) {
      const state: any = {
        table,
        _eqCol: null,
        _eqVal: null,
        _inIds: null,
        _isCount: false,
      };
      const builder: any = {
        select: (_cols: string, opts?: { count?: string; head?: boolean }) => {
          if (opts?.count) state._isCount = true;
          return builder;
        },
        eq: (c: string, v: string) => {
          state._eqCol = c;
          state._eqVal = v;
          return builder;
        },
        in: (_c: string, ids: string[]) => {
          state._inIds = ids;
          return builder;
        },
        not: () => builder,
        order: () => builder,
        limit: () => builder,
        range: async () => {
          const page = handlers.topMetroPages?.[pageCalls] ?? [];
          pageCalls++;
          return { data: page, error: null };
        },
        then: (resolve: any) => {
          if (state._isCount) {
            return Promise.resolve({
              count: handlers.countResult ?? 0,
              error: null,
            }).then(resolve);
          }
          let data: any[] = [];
          if (table === 'geography_crosswalk')
            data = handlers.crosswalk!(state._eqCol, state._eqVal);
          else if (state._inIds) data = handlers.snapshot!(state._inIds);
          return Promise.resolve({ data, error: null }).then(resolve);
        },
      };
      return builder;
    },
  } as any;
}

describe('resolveChildRegions', () => {
  it('returns every national-scope metro, unpaginated when under one page', async () => {
    const supabase = makeSupabase({
      topMetroPages: [
        [
          {
            region_id: '35620',
            region_name: 'New York',
            state_code: 'NY',
            population: 20000000,
          },
          {
            region_id: '31080',
            region_name: 'Los Angeles',
            state_code: 'CA',
            population: 13000000,
          },
        ],
      ],
    });
    const rows = await resolveChildRegions(
      supabase,
      'metro',
      undefined,
      undefined,
      false,
    );
    expect(rows).toEqual([
      { id: '35620', name: 'New York', state: 'NY', population: 20000000 },
      { id: '31080', name: 'Los Angeles', state: 'CA', population: 13000000 },
    ]);
  });

  it('paginates past a 1000-row page and returns every metro across pages', async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => ({
      region_id: String(10000 + i),
      region_name: `Metro ${i}`,
      state_code: 'XX',
      population: 1000000 - i,
    }));
    const page2 = [
      {
        region_id: '99999',
        region_name: 'Last Metro',
        state_code: 'YY',
        population: 100,
      },
    ];
    const supabase = makeSupabase({ topMetroPages: [page1, page2] });
    const rows = await resolveChildRegions(
      supabase,
      'metro',
      undefined,
      undefined,
      false,
    );
    expect(rows.length).toBe(1001);
    expect(rows[rows.length - 1].id).toBe('99999');
  });

  it('resolves counties of a metro via the crosswalk then reads snapshot names, uncapped', async () => {
    const supabase = makeSupabase({
      crosswalk: (col, val) => {
        expect(col).toBe('cbsa_code');
        expect(val).toBe('19100');
        return [{ county_fips: '48113' }, { county_fips: '48439' }];
      },
      snapshot: (ids) =>
        ids.map((id) => ({
          region_id: id,
          region_name: id === '48113' ? 'Dallas County' : 'Tarrant County',
          state_code: 'TX',
          population: id === '48113' ? 2600000 : 2100000,
        })),
    });
    const rows = await resolveChildRegions(
      supabase,
      'county',
      'metro',
      '19100',
      false,
    );
    expect(rows.map((r) => r.id).sort()).toEqual(['48113', '48439']);
    expect(rows[0].population).toBe(2600000); // sorted desc
  });

  it('does not cap county rosters even with more than 60 ids (regression: CHILD_CAP removed)', async () => {
    const ids = Array.from({ length: 75 }, (_, i) => String(48000 + i));
    const supabase = makeSupabase({
      crosswalk: () => ids.map((county_fips) => ({ county_fips })),
      snapshot: (chunkIds) =>
        chunkIds.map((id) => ({
          region_id: id,
          region_name: `County ${id}`,
          state_code: 'TX',
          population: 1000,
        })),
    });
    const rows = await resolveChildRegions(
      supabase,
      'county',
      'metro',
      '19100',
      false,
    );
    expect(rows.length).toBe(75);
  });

  it('caps zip rosters at ZIP_FETCH_CAP even with more than 70 ids', async () => {
    const ids = Array.from({ length: 100 }, (_, i) => String(70000 + i));
    const supabase = makeSupabase({
      crosswalk: () => ids.map((zip_code) => ({ zip_code })),
      snapshot: (chunkIds) =>
        chunkIds.map((id, i) => ({
          region_id: id,
          region_name: `Zip ${id}`,
          state_code: 'TX',
          population: 100000 - i,
        })),
    });
    const rows = await resolveChildRegions(
      supabase,
      'zip',
      'county',
      '48113',
      false,
    );
    expect(rows.length).toBe(ZIP_FETCH_CAP);
  });

  it('returns empty for state geoLevel (states come from US_STATES constant)', async () => {
    const supabase = makeSupabase({});
    expect(
      await resolveChildRegions(supabase, 'state', undefined, undefined, false),
    ).toEqual([]);
  });
});

describe('snapshotRoster', () => {
  it('returns every row uncapped when no cap is passed', async () => {
    const ids = Array.from({ length: 80 }, (_, i) => String(i));
    const supabase = makeSupabase({
      snapshot: (chunkIds) =>
        chunkIds.map((id) => ({
          region_id: id,
          region_name: `R${id}`,
          state_code: 'TX',
          population: 1,
        })),
    });
    const rows = await snapshotRoster(supabase, 'county', ids);
    expect(rows.length).toBe(80);
  });

  it('caps at the given number when a cap is passed', async () => {
    const ids = Array.from({ length: 80 }, (_, i) => String(i));
    const supabase = makeSupabase({
      snapshot: (chunkIds) =>
        chunkIds.map((id) => ({
          region_id: id,
          region_name: `R${id}`,
          state_code: 'TX',
          population: 1,
        })),
    });
    const rows = await snapshotRoster(supabase, 'zip', ids, 10);
    expect(rows.length).toBe(10);
  });
});

describe('resolveChildRegionsWithCount', () => {
  it('returns totalAvailable alongside a capped zip roster', async () => {
    const supabase = makeSupabase({
      crosswalk: () =>
        Array.from({ length: 140 }, (_, i) => ({ zip_code: `Z${i}` })),
      snapshot: (ids) =>
        ids.map((id, i) => ({
          region_id: id,
          region_name: id,
          state_code: 'CA',
          population: 140 - i,
        })),
      countResult: 140,
    });
    const { regions, totalAvailable } = await resolveChildRegionsWithCount(
      supabase,
      'zip',
      'county',
      '06037',
      false,
    );
    expect(regions.length).toBe(70); // ZIP_FETCH_CAP
    expect(totalAvailable).toBe(140);
  });

  it('totalAvailable equals regions.length for uncapped tiers (metro/county)', async () => {
    const supabase = makeSupabase({
      crosswalk: () => [{ county_fips: '48113' }, { county_fips: '48439' }],
      snapshot: (ids) =>
        ids.map((id) => ({
          region_id: id,
          region_name: id,
          state_code: 'TX',
          population: 1,
        })),
    });
    const { regions, totalAvailable } = await resolveChildRegionsWithCount(
      supabase,
      'county',
      'metro',
      '19100',
      false,
    );
    expect(totalAvailable).toBe(regions.length);
  });
});
