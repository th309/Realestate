import {
  calculateCapRate,
  calculateGrossYield,
  calculateGRM,
  calculate5YearCagr,
  calculateInventorySurplus,
  calculateOvervalued,
  calculateMonthsOfSupply,
  calculateAbsorptionRate,
  calculateMarketHealthScore,
  calculateInvestmentScore,
  calculateLongTermGrowthScore,
} from '../metric-formulas';

describe('metric-formulas pure functions', () => {
  it('calculateCapRate: (zori*12*0.6)/price*100', () => {
    expect(calculateCapRate(2000, 400000)).toBeCloseTo(3.6, 5);
    expect(calculateCapRate(0, 400000)).toBeNull();
    expect(calculateCapRate(2000, 0)).toBeNull();
  });
  it('calculateGrossYield: (zori*12)/price*100', () => {
    expect(calculateGrossYield(2000, 400000)).toBeCloseTo(6.0, 5);
    expect(calculateGrossYield(undefined, 400000)).toBeNull();
  });
  it('calculateGRM: price/(zori*12)', () => {
    expect(calculateGRM(480000, 2000)).toBeCloseTo(20, 5);
    expect(calculateGRM(480000, 0)).toBeNull();
  });
  it('calculate5YearCagr: (cur/past)^(1/5)-1', () => {
    expect(calculate5YearCagr(160000, 100000)).toBeCloseTo(
      Math.pow(1.6, 1 / 5) - 1,
      6,
    );
    expect(calculate5YearCagr(100000, 0)).toBeNull();
  });
  it('calculateInventorySurplus: current-avg', () => {
    expect(calculateInventorySurplus(1200, 1000)).toBe(200);
    expect(calculateInventorySurplus(undefined, 1000)).toBeNull();
  });
  it('calculateOvervalued: 0% at benchmark, +50% above', () => {
    expect(calculateOvervalued(350000, 100000)).toBeCloseTo(0, 5);
    expect(calculateOvervalued(525000, 100000)).toBeCloseTo(50, 5);
    expect(calculateOvervalued(350000, 0)).toBeNull();
  });
  it('calculateMonthsOfSupply + calculateAbsorptionRate', () => {
    expect(calculateMonthsOfSupply(600, 200)).toBeCloseTo(3.0, 5);
    expect(calculateMonthsOfSupply(600, 0)).toBeNull();
    expect(calculateAbsorptionRate(200, 600)).toBeCloseTo(33.33, 1);
  });
  it('score functions return null when no factors present', () => {
    expect(
      calculateMarketHealthScore(undefined, undefined, undefined, undefined),
    ).toBeNull();
    expect(calculateInvestmentScore(null, null)).toBeNull();
    expect(calculateLongTermGrowthScore(null, undefined)).toBeNull();
  });
});
