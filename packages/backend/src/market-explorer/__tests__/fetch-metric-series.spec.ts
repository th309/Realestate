import {
  batchIdColumn,
  fetchMetricSeriesForRegions,
} from '../fetch-metric-series';

describe('batchIdColumn', () => {
  it('maps (source, geoLevel) to the correct .in() column', () => {
    expect(batchIdColumn('propertyiq', 'county')).toBe('location_id');
    expect(batchIdColumn('zillow', 'metro')).toBe('cbsa_code');
    expect(batchIdColumn('zillow', 'county')).toBe('fips_code');
    expect(batchIdColumn('zillow', 'zip')).toBe('region_name');
    expect(batchIdColumn('realtor', 'county')).toBe('county_fips');
    expect(batchIdColumn('realtor', 'zip')).toBe('postal_code');
  });
});

describe('fetchMetricSeriesForRegions', () => {
  function makeSupabase(rows: any[], capture: any) {
    const builder: any = {
      select: (cols: string) => {
        capture.cols = cols;
        return builder;
      },
      eq: (c: string, v: string) => {
        (capture.eq ??= {})[c] = v;
        return builder;
      },
      in: (c: string, ids: string[]) => {
        capture.inCol = c;
        capture.inIds = ids;
        return builder;
      },
      gte: (c: string, v: string) => {
        capture.gte = [c, v];
        return builder;
      },
      not: () => builder,
      order: () => builder,
      range: async (from: number) => ({
        data: from === 0 ? rows : [],
        error: null,
      }),
    };
    return {
      from: (t: string) => {
        capture.table = t;
        return builder;
      },
    } as any;
  }

  it('batches a zillow metric with metric_name + cbsa_code filter', async () => {
    const capture: any = {};
    const supabase = makeSupabase(
      [{ cbsa_code: '35620', period_date: '2026-05-01', value: 700000 }],
      capture,
    );
    const out = await fetchMetricSeriesForRegions(
      supabase,
      'home_value',
      'metro',
      ['35620'],
      '2016-06-01',
    );
    expect(capture.table).toBe('zillow_metro');
    expect(capture.eq.metric_name).toBe('zhvi');
    expect(capture.inCol).toBe('cbsa_code');
    expect(capture.gte).toEqual(['period_date', '2016-06-01']);
    expect(out).toEqual([
      { regionId: '35620', date: '2026-05-01', value: 700000 },
    ]);
  });

  it('batches propertyiq score with score_type + geography filter and score_date field', async () => {
    const capture: any = {};
    const supabase = makeSupabase(
      [{ location_id: '48113', score_date: '2026-05-01', score: 61 }],
      capture,
    );
    const out = await fetchMetricSeriesForRegions(
      supabase,
      'propertyiq_score',
      'county',
      ['48113'],
      '2016-06-01',
    );
    expect(capture.table).toBe('propertyiq_scores');
    expect(capture.eq.score_type).toBe('propertyiq');
    expect(capture.eq.geography).toBe('county');
    expect(out[0]).toEqual({
      regionId: '48113',
      date: '2026-05-01',
      value: 61,
    });
  });

  it('returns [] for an unknown metric', async () => {
    const out = await fetchMetricSeriesForRegions(
      makeSupabase([], {}),
      'nope',
      'metro',
      ['x'],
      '2016-06-01',
    );
    expect(out).toEqual([]);
  });
});
