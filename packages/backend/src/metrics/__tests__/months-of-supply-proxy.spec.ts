import { CalculatedMetricsService } from '../calculated-metrics.service';

describe('months-of-supply Realtor proxy', () => {
  const svc = new CalculatedMetricsService({} as any);

  it('computes MOS = active / pending', () => {
    expect(svc.calculateMonthsOfSupply(600, 200)).toBeCloseTo(3.0);
  });

  it('returns null when pending is missing or zero', () => {
    expect(svc.calculateMonthsOfSupply(600, 0)).toBeNull();
    expect(svc.calculateMonthsOfSupply(600, undefined)).toBeNull();
  });

  it('absorption is the reciprocal percentage', () => {
    expect(svc.calculateAbsorptionRate(200, 600)).toBeCloseTo(33.33, 1);
  });
});
