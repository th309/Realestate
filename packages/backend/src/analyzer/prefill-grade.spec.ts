import { gradeDataField, gradeEstimate, pctToGrade } from './prefill-grade';

describe('pctToGrade', () => {
  it.each([
    [95, 'a'],
    [80, 'a'],
    [79, 'b'],
    [65, 'b'],
    [64, 'c'],
    [45, 'c'],
    [44, 'f'],
    [0, 'f'],
  ])('maps %i%% to grade %s', (pct, grade) => {
    expect(pctToGrade(pct)).toBe(grade);
  });
});

describe('gradeDataField', () => {
  it('grades fresh parcel data A (100%)', () => {
    expect(
      gradeDataField({ geoLevel: 'parcel', monthsStale: 0, isFallback: false }),
    ).toEqual({ grade: 'a', pct: 100 });
  });

  it('penalizes ZIP specificity (-5)', () => {
    expect(
      gradeDataField({ geoLevel: 'zip', monthsStale: 0, isFallback: false }),
    ).toEqual({ grade: 'a', pct: 95 });
  });

  it('penalizes inherited metro specificity (-30) → grade B', () => {
    expect(
      gradeDataField({ geoLevel: 'metro', monthsStale: 0, isFallback: false }),
    ).toEqual({ grade: 'b', pct: 70 });
  });

  it('penalizes staleness beyond 3 months (-2/mo, capped at -30)', () => {
    // zip(-5) + stale 8mo => (8-3)*2 = -10 => 85
    expect(
      gradeDataField({ geoLevel: 'zip', monthsStale: 8, isFallback: false })
        .pct,
    ).toBe(85);
    // cap: 100mo => -30 only
    expect(
      gradeDataField({
        geoLevel: 'parcel',
        monthsStale: 100,
        isFallback: false,
      }).pct,
    ).toBe(70);
  });

  it('penalizes fallback source (-10)', () => {
    expect(
      gradeDataField({ geoLevel: 'zip', monthsStale: 0, isFallback: true }).pct,
    ).toBe(85);
  });

  it('applies a hard cap (free-tier ZHVI price)', () => {
    // parcel/fresh would be 100, capped to 60 → grade C
    expect(
      gradeDataField({
        geoLevel: 'zip',
        monthsStale: 0,
        isFallback: false,
        capPct: 60,
      }),
    ).toEqual({ grade: 'c', pct: 60 });
  });

  it('clamps to a 1 floor and treats null geoLevel as state', () => {
    expect(
      gradeDataField({ geoLevel: null, monthsStale: 0, isFallback: false }).pct,
    ).toBe(55);
  });
});

describe('gradeEstimate', () => {
  it('grades constant estimates F (~35%)', () => {
    expect(gradeEstimate('constant')).toEqual({ grade: 'f', pct: 35 });
  });
  it('grades market-derived estimates C (~50%)', () => {
    expect(gradeEstimate('market')).toEqual({ grade: 'c', pct: 50 });
  });
});
