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

/** Thenable crosswalk/snapshot mock. */
function makeSupabase(
  cbsaByState: Record<string, string[]>,
  roster: (ids: string[]) => any[],
) {
  return {
    from(table: string) {
      const st: any = {};
      const b: any = {
        select: () => b,
        eq: (c: string, v: string) => {
          st[c] = v;
          return b;
        },
        in: (_c: string, ids: string[]) => {
          st.ids = ids;
          return b;
        },
        not: () => b,
        limit: () => b,
        then: (res: any) => {
          const data =
            table === 'geography_crosswalk'
              ? (cbsaByState[st.state_fips] ?? []).map((cbsa_code) => ({
                  cbsa_code,
                }))
              : roster(st.ids ?? []);
          return Promise.resolve({ data, error: null }).then(res);
        },
      };
      return b;
    },
  } as any;
}

describe('resolveNearbyRegions', () => {
  it('state scope → metros of adjacent states, marked nearby', async () => {
    const supabase = makeSupabase(
      { '40': ['11100'], '22': ['12940'] }, // OK / LA metros
      (ids) =>
        ids.map((id) => ({
          region_id: id,
          region_name: id,
          state_code: 'XX',
          population: 500000,
        })),
    );
    const rows = await resolveNearbyRegions(supabase, 'metro', 'state', '48');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.nearby === true)).toBe(true);
    expect(rows.map((r) => r.id)).toEqual(
      expect.arrayContaining(['11100', '12940']),
    );
  });
});
