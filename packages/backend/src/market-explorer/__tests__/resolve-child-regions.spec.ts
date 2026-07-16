import {
  resolveChildRegions,
  NATIONAL_METRO_CAP,
} from '../resolve-child-regions';

/** Minimal thenable Supabase query-builder mock. */
function makeSupabase(handlers: {
  crosswalk?: (col: string, val: string) => any[];
  snapshot?: (ids: string[]) => any[];
  topMetros?: () => any[];
}) {
  return {
    from(table: string) {
      const state: any = {
        table,
        _eqCol: null,
        _eqVal: null,
        _inIds: null,
        _notFilters: [] as { col: string; op: string; val: unknown }[],
      };
      const builder: any = {
        select: () => builder,
        eq: (c: string, v: string) => {
          state._eqCol = c;
          state._eqVal = v;
          return builder;
        },
        in: (_c: string, ids: string[]) => {
          state._inIds = ids;
          return builder;
        },
        not: (col: string, op: string, val: unknown) => {
          state._notFilters.push({ col, op, val });
          return builder;
        },
        order: () => builder,
        limit: () => builder,
        then: (resolve: any) => {
          let data: any[] = [];
          if (table === 'geography_crosswalk')
            data = handlers.crosswalk!(state._eqCol, state._eqVal);
          else if (state._inIds) data = handlers.snapshot!(state._inIds);
          else {
            data = handlers.topMetros!();
            // Simulate Supabase's `.not(col, 'is', null)` server-side filter.
            for (const f of state._notFilters) {
              if (f.op === 'is' && f.val === null) {
                data = data.filter((r) => r[f.col] != null);
              }
            }
          }
          return Promise.resolve({ data, error: null }).then(resolve);
        },
      };
      return builder;
    },
  } as any;
}

describe('resolveChildRegions', () => {
  it('returns top-N metros by population at national scope', async () => {
    const supabase = makeSupabase({
      topMetros: () => [
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
    });
    const rows = await resolveChildRegions(
      supabase,
      'metro',
      undefined,
      undefined,
      false,
    );
    expect(rows[0]).toEqual({
      id: '35620',
      name: 'New York',
      state: 'NY',
      population: 20000000,
    });
    expect(rows.length).toBeLessThanOrEqual(NATIONAL_METRO_CAP);
  });

  it('regression: still returns national-scope metros when population is null for every row', async () => {
    const supabase = makeSupabase({
      topMetros: () => [
        {
          region_id: '35620',
          region_name: 'New York',
          state_code: 'NY',
          population: null,
        },
        {
          region_id: '31080',
          region_name: 'Los Angeles',
          state_code: 'CA',
          population: null,
        },
      ],
    });
    const rows = await resolveChildRegions(
      supabase,
      'metro',
      undefined,
      undefined,
      false,
    );
    expect(rows.length).toBe(2);
    expect(rows.map((r) => r.id).sort()).toEqual(['31080', '35620']);
    expect(rows.every((r) => r.population === null)).toBe(true);
  });

  it('resolves counties of a metro via the crosswalk then reads snapshot names', async () => {
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

  it('returns empty for state geoLevel (states come from US_STATES constant)', async () => {
    const supabase = makeSupabase({});
    expect(
      await resolveChildRegions(supabase, 'state', undefined, undefined, false),
    ).toEqual([]);
  });
});
