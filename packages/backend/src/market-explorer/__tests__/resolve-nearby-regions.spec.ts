import { adjacentStateFips } from '../us-tiles';
import { resolveNearbyRegions } from '../resolve-nearby-regions';

describe('adjacentStateFips', () => {
  it('returns tile-adjacent states (TX → OK, LA) and excludes self/far states', () => {
    const adj = adjacentStateFips('48'); // Texas
    expect(adj).toContain('40'); // Oklahoma
    expect(adj).toContain('22'); // Louisiana
    expect(adj).not.toContain('48'); // not self
    expect(adj).not.toContain('36'); // New York is far
  });
});

/**
 * Thenable crosswalk/snapshot mock, general enough to cover every
 * (eqCol, selectCol) shape resolveNearbyRegions issues against
 * `geography_crosswalk` (both `distinctCrosswalkIds` and `lookupOne`),
 * plus `screener_snapshot` for the roster read. Records every `.order()`
 * call so tests can assert the deterministic-lookup fix.
 */
function makeSupabase(config: {
  crosswalk: (eqCol: string, eqVal: string, selectCol: string) => string[];
  roster: (ids: string[]) => any[];
  orderCalls?: string[];
}) {
  return {
    from(table: string) {
      const st: any = {};
      const b: any = {
        select: (col: string) => {
          st.selectCol = col;
          return b;
        },
        eq: (c: string, v: string) => {
          st.eqCol = c;
          st.eqVal = v;
          return b;
        },
        in: (_c: string, ids: string[]) => {
          st.ids = ids;
          return b;
        },
        not: () => b,
        order: (col: string) => {
          config.orderCalls?.push(col);
          return b;
        },
        limit: () => b,
        then: (res: any) => {
          const data =
            table === 'geography_crosswalk'
              ? config
                  .crosswalk(st.eqCol, st.eqVal, st.selectCol)
                  .map((v) => ({ [st.selectCol]: v }))
              : config.roster(st.ids ?? []);
          return Promise.resolve({ data, error: null }).then(res);
        },
      };
      return b;
    },
  } as any;
}

describe('resolveNearbyRegions', () => {
  it('state scope → metros of adjacent states, marked nearby', async () => {
    const cbsaByState: Record<string, string[]> = {
      '40': ['11100'], // Oklahoma
      '22': ['12940'], // Louisiana
    };
    const supabase = makeSupabase({
      crosswalk: (eqCol, eqVal, selectCol) =>
        eqCol === 'state_fips' && selectCol === 'cbsa_code'
          ? (cbsaByState[eqVal] ?? [])
          : [],
      roster: (ids) =>
        ids.map((id) => ({
          region_id: id,
          region_name: id,
          state_code: 'XX',
          population: 500000,
        })),
    });
    const rows = await resolveNearbyRegions(supabase, 'metro', 'state', '48');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.nearby === true)).toBe(true);
    expect(rows.map((r) => r.id)).toEqual(
      expect.arrayContaining(['11100', '12940']),
    );
  });

  it('metro scope → counties of sibling metros in the same state, marked nearby (lookupOne orders deterministically)', async () => {
    const orderCalls: string[] = [];
    const supabase = makeSupabase({
      orderCalls,
      crosswalk: (eqCol, eqVal, selectCol) => {
        // lookupOne: metro (Dallas, 19100) → its state.
        if (
          eqCol === 'cbsa_code' &&
          eqVal === '19100' &&
          selectCol === 'state_fips'
        )
          return ['48'];
        // distinctCrosswalkIds: sibling metros of TX (Dallas + Houston).
        if (
          eqCol === 'state_fips' &&
          eqVal === '48' &&
          selectCol === 'cbsa_code'
        )
          return ['19100', '26420'];
        // distinctCrosswalkIds: counties of sibling metro Houston (26420).
        if (
          eqCol === 'cbsa_code' &&
          eqVal === '26420' &&
          selectCol === 'county_fips'
        )
          return ['48201'];
        return [];
      },
      roster: (ids) =>
        ids.map((id) => ({
          region_id: id,
          region_name: `County ${id}`,
          state_code: 'TX',
          population: 1000000,
        })),
    });
    const rows = await resolveNearbyRegions(
      supabase,
      'county',
      'metro',
      '19100',
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.nearby === true)).toBe(true);
    expect(rows.map((r) => r.id)).toEqual(expect.arrayContaining(['48201']));
    // The parent metro (19100) is excluded — only sibling-metro counties come back.
    expect(rows.map((r) => r.id)).not.toContain('19100');
    expect(orderCalls).toContain('state_fips');
  });

  it('caps the zip-nearby branch at ZIP_FETCH_CAP even with more sibling zips than that', async () => {
    const manyZips = Array.from({ length: 90 }, (_, i) => `7600${i}`);
    const supabase = makeSupabase({
      crosswalk: (eqCol, eqVal, selectCol) => {
        if (
          eqCol === 'county_fips' &&
          eqVal === '48113' &&
          selectCol === 'cbsa_code'
        )
          return ['19100'];
        if (
          eqCol === 'cbsa_code' &&
          eqVal === '19100' &&
          selectCol === 'county_fips'
        )
          return ['48113', '48439'];
        if (
          eqCol === 'county_fips' &&
          eqVal === '48439' &&
          selectCol === 'zip_code'
        )
          return manyZips;
        return [];
      },
      roster: (ids) =>
        ids.map((id, i) => ({
          region_id: id,
          region_name: `ZIP ${id}`,
          state_code: 'TX',
          population: 100000 - i,
        })),
    });
    const rows = await resolveNearbyRegions(supabase, 'zip', 'county', '48113');
    expect(rows.length).toBe(70); // ZIP_FETCH_CAP
    expect(rows.every((r) => r.nearby === true)).toBe(true);
  });

  it('county scope → zips of sibling counties in the same metro, marked nearby (lookupOne orders deterministically)', async () => {
    const orderCalls: string[] = [];
    const supabase = makeSupabase({
      orderCalls,
      crosswalk: (eqCol, eqVal, selectCol) => {
        // lookupOne: county (Dallas County, 48113) → its metro.
        if (
          eqCol === 'county_fips' &&
          eqVal === '48113' &&
          selectCol === 'cbsa_code'
        )
          return ['19100'];
        // distinctCrosswalkIds: sibling counties of metro 19100 (Dallas + Tarrant).
        if (
          eqCol === 'cbsa_code' &&
          eqVal === '19100' &&
          selectCol === 'county_fips'
        )
          return ['48113', '48439'];
        // distinctCrosswalkIds: zips of sibling county Tarrant (48439).
        if (
          eqCol === 'county_fips' &&
          eqVal === '48439' &&
          selectCol === 'zip_code'
        )
          return ['76001', '76002'];
        return [];
      },
      roster: (ids) =>
        ids.map((id) => ({
          region_id: id,
          region_name: `ZIP ${id}`,
          state_code: 'TX',
          population: 20000,
        })),
    });
    const rows = await resolveNearbyRegions(supabase, 'zip', 'county', '48113');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.nearby === true)).toBe(true);
    expect(rows.map((r) => r.id)).toEqual(
      expect.arrayContaining(['76001', '76002']),
    );
    expect(orderCalls).toContain('cbsa_code');
  });
});
