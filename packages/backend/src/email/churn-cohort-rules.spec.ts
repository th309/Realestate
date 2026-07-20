import {
  isZeroSessionEligible,
  isTriedOnceEligible,
  isEngagedThenQuietEligible,
} from './churn-cohort-rules';

describe('churn cohort eligibility rules', () => {
  it('zero-session: eligible at 0 or 1 sessions, not at 2+', () => {
    expect(isZeroSessionEligible(0)).toBe(true);
    expect(isZeroSessionEligible(1)).toBe(true);
    expect(isZeroSessionEligible(2)).toBe(false);
  });

  it('tried-once: eligible only at exactly 2 sessions', () => {
    expect(isTriedOnceEligible(1)).toBe(false);
    expect(isTriedOnceEligible(2)).toBe(true);
    expect(isTriedOnceEligible(3)).toBe(false);
  });

  it('engaged-then-quiet: eligible at 3+ sessions', () => {
    expect(isEngagedThenQuietEligible(2)).toBe(false);
    expect(isEngagedThenQuietEligible(3)).toBe(true);
    expect(isEngagedThenQuietEligible(10)).toBe(true);
  });
});
