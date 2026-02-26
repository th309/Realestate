/**
 * Cross-Score Weight Validation & Score Bounds Tests
 *
 * Validates weight constraints across all three score types and
 * verifies score bounds at extremes.
 */

import {
  HOMEREADY_WEIGHTS,
  INVESTOREDGE_WEIGHTS,
  MARKET_HEALTH_WEIGHTS,
} from '../../scoring.types';
import {
  TestHomeReadyComponents,
  TestInvestorEdgeComponents,
  TestMarketHealthComponents,
  calculateExpectedHomeReady,
  calculateExpectedInvestorEdge,
  calculateExpectedMarketHealth,
  validateWeightSums,
} from '../fixtures/expected-scores';

const WEIGHT_PRECISION = 10;

describe('Cross-Score Weight Validation', () => {
  it('validates all weight sums using fixture helper', () => {
    expect(() => validateWeightSums()).not.toThrow();
  });

  it('all three score types have weights summing to 1.0', () => {
    const homeReadySum = Object.values(HOMEREADY_WEIGHTS).reduce(
      (a, b) => a + b,
      0,
    );
    const investorEdgeSum = Object.values(INVESTOREDGE_WEIGHTS).reduce(
      (a, b) => a + b,
      0,
    );
    const marketHealthSum = Object.values(MARKET_HEALTH_WEIGHTS).reduce(
      (a, b) => a + b,
      0,
    );

    expect(homeReadySum).toBeCloseTo(1.0, WEIGHT_PRECISION);
    expect(investorEdgeSum).toBeCloseTo(1.0, WEIGHT_PRECISION);
    expect(marketHealthSum).toBeCloseTo(1.0, WEIGHT_PRECISION);
  });

  it('HomeReady and InvestorEdge have the same number of components', () => {
    const homeReadyCount = Object.keys(HOMEREADY_WEIGHTS).length;
    const investorEdgeCount = Object.keys(INVESTOREDGE_WEIGHTS).length;
    expect(homeReadyCount).toBe(5);
    expect(investorEdgeCount).toBe(5);
  });

  it('Market Health has fewer components (4 vs 5)', () => {
    const marketHealthCount = Object.keys(MARKET_HEALTH_WEIGHTS).length;
    expect(marketHealthCount).toBe(4);
  });

  describe('weight symmetry', () => {
    it('no weight exceeds 0.35 (35%)', () => {
      const allWeights = [
        ...Object.values(HOMEREADY_WEIGHTS),
        ...Object.values(INVESTOREDGE_WEIGHTS),
        ...Object.values(MARKET_HEALTH_WEIGHTS),
      ];
      const max = Math.max(...allWeights);
      expect(max).toBeLessThanOrEqual(0.35);
    });

    it('no weight is below 0.10 (10%)', () => {
      const allWeights = [
        ...Object.values(HOMEREADY_WEIGHTS),
        ...Object.values(INVESTOREDGE_WEIGHTS),
        ...Object.values(MARKET_HEALTH_WEIGHTS),
      ];
      const min = Math.min(...allWeights);
      expect(min).toBeGreaterThanOrEqual(0.1);
    });

    it('all weights are positive', () => {
      const allWeights = [
        ...Object.values(HOMEREADY_WEIGHTS),
        ...Object.values(INVESTOREDGE_WEIGHTS),
        ...Object.values(MARKET_HEALTH_WEIGHTS),
      ];
      for (const weight of allWeights) {
        expect(weight).toBeGreaterThan(0);
      }
    });
  });
});

describe('Score Bounds with Weights', () => {
  it('HomeReady score is always between 0 and 100', () => {
    const minComponents: TestHomeReadyComponents = {
      affordability: 0,
      market_timing: 0,
      stability: 0,
      growth_potential: 0,
      livability: 0,
    };
    const maxComponents: TestHomeReadyComponents = {
      affordability: 100,
      market_timing: 100,
      stability: 100,
      growth_potential: 100,
      livability: 100,
    };

    expect(calculateExpectedHomeReady(minComponents)).toBe(0);
    expect(calculateExpectedHomeReady(maxComponents)).toBe(100);
  });

  it('InvestorEdge score is always between 0 and 100', () => {
    const minComponents: TestInvestorEdgeComponents = {
      cash_flow: 0,
      rent_demand: 0,
      appreciation: 0,
      entry_point: 0,
      risk: 0,
    };
    const maxComponents: TestInvestorEdgeComponents = {
      cash_flow: 100,
      rent_demand: 100,
      appreciation: 100,
      entry_point: 100,
      risk: 100,
    };

    expect(calculateExpectedInvestorEdge(minComponents)).toBe(0);
    expect(calculateExpectedInvestorEdge(maxComponents)).toBe(100);
  });

  it('Market Health score is always between 0 and 100', () => {
    const minComponents: TestMarketHealthComponents = {
      demand_strength: 0,
      supply_balance: 0,
      price_stability: 0,
      economic_foundation: 0,
    };
    const maxComponents: TestMarketHealthComponents = {
      demand_strength: 100,
      supply_balance: 100,
      price_stability: 100,
      economic_foundation: 100,
    };

    expect(calculateExpectedMarketHealth(minComponents)).toBe(0);
    expect(calculateExpectedMarketHealth(maxComponents)).toBe(100);
  });
});
