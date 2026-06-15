import { calculateOvervalued } from '../metric-formulas';

describe('overvalued % formula', () => {
  it('0% at benchmark', () => {
    expect(calculateOvervalued(350000, 100000)).toBeCloseTo(0, 5);
  });
  it('+50% above benchmark', () => {
    expect(calculateOvervalued(525000, 100000)).toBeCloseTo(50, 5);
  });
  it('null on missing/zero income', () => {
    expect(calculateOvervalued(350000, 0)).toBeNull();
  });
  it('null on missing price', () => {
    expect(calculateOvervalued(0, 100000)).toBeNull();
  });
  it('null on undefined inputs', () => {
    expect(calculateOvervalued(undefined, undefined)).toBeNull();
  });
});
