import { alignAndMergeMetrics } from '../merge-metric-series';

describe('alignAndMergeMetrics', () => {
  it('anchors all metrics on the latest date present across ANY metric, padding laggards with trailing nulls', () => {
    const result = alignAndMergeMetrics(
      [
        {
          metric: 'home_value',
          rows: [
            { regionId: 'A', date: '2026-04-15', value: 100 },
            { regionId: 'A', date: '2026-05-15', value: 110 },
          ],
        },
        {
          metric: 'hotness_score',
          rows: [{ regionId: 'A', date: '2026-04-01', value: 70 }],
        },
      ],
      2,
    );
    expect(result.dates).toEqual(['2026-04-01', '2026-05-01']);
    expect(result.series.home_value.A).toEqual([100, 110]);
    expect(result.series.hotness_score.A).toEqual([70, null]);
  });

  it('gives a metric with zero rows an empty series object instead of crashing', () => {
    const result = alignAndMergeMetrics(
      [
        {
          metric: 'home_value',
          rows: [{ regionId: 'A', date: '2026-05-01', value: 100 }],
        },
        { metric: 'hotness_score', rows: [] },
      ],
      1,
    );
    expect(result.dates).toEqual(['2026-05-01']);
    expect(result.series.home_value.A).toEqual([100]);
    expect(result.series.hotness_score).toEqual({});
  });

  it('returns empty dates/series when every metric has zero rows', () => {
    expect(
      alignAndMergeMetrics(
        [
          { metric: 'home_value', rows: [] },
          { metric: 'hotness_score', rows: [] },
        ],
        6,
      ),
    ).toEqual({ dates: [], series: {} });
  });

  it('returns empty dates/series for an empty metric list', () => {
    expect(alignAndMergeMetrics([], 6)).toEqual({ dates: [], series: {} });
  });
});
