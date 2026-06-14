import {
  estimateInsuranceAnnual,
  estimateVacancyFraction,
  estimateRentGrowthFraction,
  estimateTaxAnnual,
} from './prefill-estimates';

describe('estimateInsuranceAnnual', () => {
  it('is 0.55%/yr of price', () => {
    expect(estimateInsuranceAnnual(400_000)).toBe(2200);
  });
  it('returns null for missing/zero price', () => {
    expect(estimateInsuranceAnnual(null)).toBeNull();
    expect(estimateInsuranceAnnual(0)).toBeNull();
  });
});

describe('estimateVacancyFraction', () => {
  it('is a flat 5% fraction', () => {
    expect(estimateVacancyFraction()).toBe(0.05);
  });
});

describe('estimateRentGrowthFraction', () => {
  it('defaults to 3% when appreciation is unknown', () => {
    expect(estimateRentGrowthFraction(null)).toBe(0.03);
  });
  it('tracks appreciation (percent input) clamped to 2–5%', () => {
    expect(estimateRentGrowthFraction(4)).toBe(0.04); // 4% -> 0.04
    expect(estimateRentGrowthFraction(9)).toBe(0.05); // clamp high
    expect(estimateRentGrowthFraction(1)).toBe(0.02); // clamp low
  });
});

describe('estimateTaxAnnual', () => {
  it('is ~1.1% effective rate of price', () => {
    expect(estimateTaxAnnual(300_000)).toBe(3300);
  });
  it('returns null for missing price', () => {
    expect(estimateTaxAnnual(null)).toBeNull();
  });
});
