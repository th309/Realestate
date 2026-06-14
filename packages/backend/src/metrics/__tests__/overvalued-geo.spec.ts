import { CalculatedMetricsService } from '../calculated-metrics.service';

describe('overvalued % formula', () => {
  const svc = new CalculatedMetricsService({} as any);

  it('0% at benchmark', () => {
    expect(svc.calculateOvervalued(350000, 100000)).toBeCloseTo(0, 5);
  });

  it('+50% above benchmark', () => {
    expect(svc.calculateOvervalued(525000, 100000)).toBeCloseTo(50, 5);
  });

  it('null on missing/zero income', () => {
    expect(svc.calculateOvervalued(350000, 0)).toBeNull();
  });

  it('null on missing price', () => {
    expect(svc.calculateOvervalued(0, 100000)).toBeNull();
  });

  it('null on undefined inputs', () => {
    expect(svc.calculateOvervalued(undefined, undefined)).toBeNull();
  });
});
