import { US_STATES, stateFipsByAbbr, stateRegions } from '../us-states';
import { fetchStateMetricSeries } from '../fetch-state-series';

describe('US_STATES', () => {
  it('covers all 50 states plus DC with unique FIPS', () => {
    expect(US_STATES).toHaveLength(51);
    expect(new Set(US_STATES.map((s) => s.fips)).size).toBe(51);
    expect(stateFipsByAbbr['TX']).toBe('48');
    expect(stateRegions()[0]).toHaveProperty('id');
  });
});

describe('fetchStateMetricSeries', () => {
  it('calls the aggregation RPC for propertyiq_score', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: [{ state_fips: '48', score_date: '2026-05-01', avg_score: 55.5 }],
      error: null,
    });
    const supabase = { rpc } as any;
    const rows = await fetchStateMetricSeries(
      supabase,
      'propertyiq_score',
      '2016-06-01',
    );
    expect(rpc).toHaveBeenCalledWith('me_state_score_series', {
      p_start: '2016-06-01',
    });
    expect(rows[0]).toEqual({
      regionId: '48',
      date: '2026-05-01',
      value: 55.5,
    });
  });

  it('reads native zillow_state rows and maps region_name to FIPS', async () => {
    const builder: any = {
      select: () => builder,
      eq: () => builder,
      gte: () => builder,
      not: () => builder,
      order: () => builder,
      range: async (from: number) => ({
        data:
          from === 0
            ? [
                {
                  region_name: 'Texas',
                  period_date: '2026-05-01',
                  value: 350000,
                },
              ]
            : [],
        error: null,
      }),
    };
    const supabase = { from: () => builder, rpc: jest.fn() } as any;
    const rows = await fetchStateMetricSeries(
      supabase,
      'home_value',
      '2016-06-01',
    );
    expect(rows[0]).toEqual({
      regionId: '48',
      date: '2026-05-01',
      value: 350000,
    });
  });
});
