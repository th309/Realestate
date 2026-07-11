import { bucketScores, MOMENTUM_BANDS } from './scoring-queries-distribution';

describe('bucketScores groups scores into the momentum bands from CLAUDE.md section 9', () => {
  it('counts each band and boundary values correctly', () => {
    const scores = [95, 85, 75, 65, 55, 45, 30, 10, 50, 59, 60, 90];
    const buckets = bucketScores(scores);
    const byLabel = Object.fromEntries(buckets.map((b) => [b.label, b.count]));
    expect(byLabel['VERY STRONG']).toBe(2); // 95, 90
    expect(byLabel['STRONG']).toBe(1); // 85
    expect(byLabel['RISING']).toBe(1); // 75
    expect(byLabel['FIRMING']).toBe(2); // 65, 60
    expect(byLabel['STEADY']).toBe(3); // 55, 50, 59
    expect(byLabel['EASING']).toBe(1); // 45
    expect(byLabel['WEAK']).toBe(1); // 30
    expect(byLabel['VERY WEAK']).toBe(1); // 10
  });

  it('returns all eight bands even when empty', () => {
    expect(bucketScores([]).length).toBe(MOMENTUM_BANDS.length);
    expect(bucketScores([]).every((b) => b.count === 0)).toBe(true);
  });
});
