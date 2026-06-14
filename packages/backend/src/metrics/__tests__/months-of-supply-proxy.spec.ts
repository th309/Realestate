import { CalculatedMetricsService } from '../calculated-metrics.service';

describe('months-of-supply Realtor proxy', () => {
  const svc = new CalculatedMetricsService({} as any);

  it('computes MOS = active / pending', () => {
    expect(svc.calculateMonthsOfSupply(600, 200)).toBeCloseTo(3.0);
  });

  it('returns null when pending is missing or zero', () => {
    expect(svc.calculateMonthsOfSupply(600, 0)).toBeNull();
    expect(svc.calculateMonthsOfSupply(600, undefined)).toBeNull();
  });

  it('absorption is the reciprocal percentage', () => {
    expect(svc.calculateAbsorptionRate(200, 600)).toBeCloseTo(33.33, 1);
  });
});

describe('fetchRealtorMosInputs null-skip regression', () => {
  it('excludes regions where active_listing_count or pending_listing_count is null', async () => {
    // Rows returned by the DB: one valid, one with null pending, one with null active
    const fakeRows = [
      {
        cbsa_code: '10001',
        active_listing_count: 500,
        pending_listing_count: 100,
      },
      {
        cbsa_code: '10002',
        active_listing_count: 300,
        pending_listing_count: null,
      },
      {
        cbsa_code: '10003',
        active_listing_count: null,
        pending_listing_count: 80,
      },
    ];

    // Build a minimal supabase stub that satisfies the query chain used by fetchRealtorMosInputs.
    // Query 1: .from(table).select('period_date').order(...).limit(1).maybeSingle()
    // Query 2: .from(table).select(...).eq('period_date', ...).range(from, to)
    let pageCallCount = 0;
    // makePageResult: first call returns fakeRows, subsequent calls return [] to stop pagination.
    const makePageResult = async () => {
      pageCallCount++;
      return pageCallCount === 1
        ? { data: fakeRows, error: null }
        : { data: [], error: null };
    };
    // eqNode has both .range() (for single-eq data query) and .eq() (for any chained eq paths).
    const makeEqNode = (): any => ({
      range: makePageResult,
      eq: () => makeEqNode(),
    });
    const fakeSupabase = {
      from: (_table: string) => ({
        select: (_cols: string) => ({
          order: () => ({
            limit: () => ({
              maybeSingle: async () => ({
                data: { period_date: '2026-04-01' },
              }),
            }),
          }),
          eq: () => makeEqNode(),
        }),
      }),
    };

    const svcWithFake = new CalculatedMetricsService(fakeSupabase as any);
    const result = await (svcWithFake as any).fetchRealtorMosInputs('metro');

    // Only the row with both values present should be stored
    expect(result.size).toBe(1);
    expect(result.has('10001')).toBe(true);
    expect(result.get('10001')).toEqual({ active: 500, pending: 100 });

    // Null-pending and null-active rows must be absent
    expect(result.has('10002')).toBe(false);
    expect(result.has('10003')).toBe(false);
  });
});
