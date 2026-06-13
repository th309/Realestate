import { calculatePropertyIqScores } from '../propertyiq-scoring-engine';
import type { LocationMetrics } from '../scoring.types';

function loc(id: string, m: Record<string, number | null>): LocationMetrics {
  return { location_id: id, location_name: id, ...m } as any;
}

describe('calculatePropertyIqScores with the momentum+flow formula', () => {
  it('scores hot market above cold market with full-data A confidence', () => {
    // 5 monotone locations: hottest must rank top, coldest bottom.
    const locations = [
      loc('hot', {
        zhvi_yoy: 0.1,
        zhvi_mom_3m: 0.03,
        median_days_on_market: 20,
        price_reduced_share: 0.05,
      }),
      loc('warm', {
        zhvi_yoy: 0.07,
        zhvi_mom_3m: 0.02,
        median_days_on_market: 30,
        price_reduced_share: 0.1,
      }),
      loc('mid', {
        zhvi_yoy: 0.05,
        zhvi_mom_3m: 0.01,
        median_days_on_market: 40,
        price_reduced_share: 0.15,
      }),
      loc('cool', {
        zhvi_yoy: 0.03,
        zhvi_mom_3m: 0.0,
        median_days_on_market: 50,
        price_reduced_share: 0.2,
      }),
      loc('cold', {
        zhvi_yoy: 0.0,
        zhvi_mom_3m: -0.01,
        median_days_on_market: 60,
        price_reduced_share: 0.25,
      }),
    ];
    const results = calculatePropertyIqScores(locations, 'metro');
    const byId = Object.fromEntries(results.map((r) => [r.locationId, r]));
    expect(results).toHaveLength(5);
    expect(byId.hot.score).toBeGreaterThan(byId.cold.score);
    expect(byId.hot.score).toBe(99); // pct 100 -> top of the [50, 99] segment
    // Average-rank percentile of the median of 5 distinct signals is 3/5 = 60
    // (pandas rank(pct=True) convention), which re-centers to score 60.
    expect(byId.mid.score).toBe(60);
    expect(byId.hot.confidence).toBe(100); // 4/4
    expect(byId.hot.confidenceLevel).toBe('A');
    expect(byId.hot.inputMetrics.zhvi_yoy).toBe(0.1);
  });

  it('maps the percentile-50 location to exactly score 50 (zero-crossing)', () => {
    // 4 distinct signals -> percentiles 25/50/75/100; the location at
    // percentile 50 must score exactly 50 because the zero-crossing is 50
    // at every geography level (the old 55.6 crossing would give 45).
    const locations = [
      loc('hot', {
        zhvi_yoy: 0.1,
        zhvi_mom_3m: 0.03,
        median_days_on_market: 20,
        price_reduced_share: 0.05,
      }),
      loc('warm', {
        zhvi_yoy: 0.07,
        zhvi_mom_3m: 0.02,
        median_days_on_market: 30,
        price_reduced_share: 0.1,
      }),
      loc('cool', {
        zhvi_yoy: 0.03,
        zhvi_mom_3m: 0.0,
        median_days_on_market: 50,
        price_reduced_share: 0.2,
      }),
      loc('cold', {
        zhvi_yoy: 0.0,
        zhvi_mom_3m: -0.01,
        median_days_on_market: 60,
        price_reduced_share: 0.25,
      }),
    ];
    const results = calculatePropertyIqScores(locations, 'county');
    const byId = Object.fromEntries(results.map((r) => [r.locationId, r]));
    expect(byId.cool.percentileRank).toBe(50);
    expect(byId.cool.score).toBe(50);
  });

  it('scores with 2 of 4 features at C confidence (momentum-only)', () => {
    const locations = [
      loc('a', {
        zhvi_yoy: 0.1,
        zhvi_mom_3m: 0.03,
        median_days_on_market: null,
        price_reduced_share: null,
      }),
      loc('b', {
        zhvi_yoy: 0.05,
        zhvi_mom_3m: 0.01,
        median_days_on_market: null,
        price_reduced_share: null,
      }),
      loc('c', {
        zhvi_yoy: 0.0,
        zhvi_mom_3m: -0.01,
        median_days_on_market: null,
        price_reduced_share: null,
      }),
    ];
    const results = calculatePropertyIqScores(locations, 'zip');
    expect(results).toHaveLength(3);
    expect(results[0].confidence).toBe(50); // 2/4
    expect(results[0].confidenceLevel).toBe('C');
  });

  it('skips locations with fewer than 2 features', () => {
    const locations = [
      loc('a', {
        zhvi_yoy: 0.1,
        zhvi_mom_3m: 0.03,
        median_days_on_market: 20,
        price_reduced_share: 0.05,
      }),
      loc('b', {
        zhvi_yoy: 0.05,
        zhvi_mom_3m: 0.01,
        median_days_on_market: 30,
        price_reduced_share: 0.1,
      }),
      loc('only-one', {
        zhvi_yoy: 0.02,
        zhvi_mom_3m: null,
        median_days_on_market: null,
        price_reduced_share: null,
      }),
    ];
    const results = calculatePropertyIqScores(locations, 'metro');
    expect(results.map((r) => r.locationId)).not.toContain('only-one');
  });
});
