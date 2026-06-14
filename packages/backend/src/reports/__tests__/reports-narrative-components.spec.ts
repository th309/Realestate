import {
  computeComponentExtremes,
  computeKeyTension,
} from '../reports-narrative-cross-section';
import { buildComponentVars } from '../reports-narrative-template-vars';

/**
 * Regression guard for the production "components is not iterable" crash.
 *
 * The v4 PropertyIQ score has no multi-component breakdown. If a non-array
 * `components` value (e.g. a raw z_scores Record) reaches the narrative
 * builders, the [...components] spread / for-of must NOT throw — report
 * generation has to degrade gracefully.
 */
describe('report narrative builders — non-array / missing components', () => {
  const v4ScoreWithRecordComponents = {
    scores: {
      propertyiq: {
        score: 5,
        grade: 'F',
        // a Record, NOT an array — the exact shape that crashed prod
        components: {
          zhvi_yoy: -0.034,
          zhvi_mom_3m: 0.009,
          median_days_on_market: 51,
          price_reduced_share: 0.236,
        },
      },
    },
  };
  const v4ScoreNoComponents = {
    scores: { propertyiq: { score: 5, grade: 'F' } },
  };

  it('computeComponentExtremes returns N/A on a Record (no throw)', () => {
    expect(() =>
      computeComponentExtremes(v4ScoreWithRecordComponents, 'investor'),
    ).not.toThrow();
    expect(
      computeComponentExtremes(v4ScoreWithRecordComponents, 'investor')
        .strongest_component,
    ).toBe('N/A');
  });

  it('computeKeyTension returns insufficient-data on a Record (no throw)', () => {
    expect(() =>
      computeKeyTension(v4ScoreWithRecordComponents, 'homebuyer'),
    ).not.toThrow();
    expect(computeKeyTension(v4ScoreWithRecordComponents, 'investor')).toMatch(
      /insufficient data/i,
    );
  });

  it('handles missing components (undefined) gracefully', () => {
    expect(() =>
      computeComponentExtremes(v4ScoreNoComponents, 'investor'),
    ).not.toThrow();
    expect(computeKeyTension(v4ScoreNoComponents, 'investor')).toMatch(
      /insufficient data/i,
    );
  });

  it('buildComponentVars falls back to N/A on a non-array components (no throw)', () => {
    const recordComponents = { zhvi_yoy: -0.034 } as unknown as undefined;
    expect(() =>
      buildComponentVars(recordComponents, ['affordability']),
    ).not.toThrow();
    expect(
      buildComponentVars(recordComponents, ['affordability'])[
        'affordability_score'
      ],
    ).toBe('N/A');
  });

  it('still computes extremes for legacy array components', () => {
    const legacy = {
      scores: {
        propertyiq: {
          score: 70,
          grade: 'C',
          components: [
            { component: 'growth', score: 80, status: 'good' },
            { component: 'stability', score: 40, status: 'weak' },
          ],
        },
      },
    };
    const out = computeComponentExtremes(legacy, 'investor');
    expect(out.strongest_component).toBe('Growth');
    expect(out.weakest_component).toBe('Stability');
  });
});
