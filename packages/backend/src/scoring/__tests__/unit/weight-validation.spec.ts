/**
 * Weight Validation Unit Tests
 *
 * Verifies that scoring weights are correct and consistent:
 * 1. All weights sum to exactly 1.0 (100%)
 * 2. Individual weight values match documentation
 * 3. Weighted score calculation is correct
 *
 * These are critical tests - incorrect weights would produce systematically
 * wrong scores affecting $100K-$1M real estate decisions.
 */

import {
  HOMEREADY_WEIGHTS,
  INVESTOREDGE_WEIGHTS,
  MARKET_HEALTH_WEIGHTS,
  HomeReadyComponents,
  InvestorEdgeComponents,
  MarketHealthComponents,
} from '../../scoring.types';
import {
  calculateExpectedHomeReady,
  calculateExpectedInvestorEdge,
  calculateExpectedMarketHealth,
  validateWeightSums,
} from '../fixtures/expected-scores';

describe('Weight Validation', () => {
  // Precision for floating point comparisons
  const WEIGHT_PRECISION = 10; // 10 decimal places

  describe('HomeReady Weights', () => {
    describe('individual weights', () => {
      it('affordability weight is 0.30 (30%)', () => {
        expect(HOMEREADY_WEIGHTS.affordability).toBe(0.3);
      });

      it('market_timing weight is 0.25 (25%)', () => {
        expect(HOMEREADY_WEIGHTS.market_timing).toBe(0.25);
      });

      it('stability weight is 0.20 (20%)', () => {
        expect(HOMEREADY_WEIGHTS.stability).toBe(0.2);
      });

      it('growth_potential weight is 0.15 (15%)', () => {
        expect(HOMEREADY_WEIGHTS.growth_potential).toBe(0.15);
      });

      it('livability weight is 0.10 (10%)', () => {
        expect(HOMEREADY_WEIGHTS.livability).toBe(0.1);
      });
    });

    describe('weight sum', () => {
      it('all weights sum to exactly 1.0', () => {
        const sum = Object.values(HOMEREADY_WEIGHTS).reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1.0, WEIGHT_PRECISION);
      });

      it('weight sum is exactly 1.0 (high precision)', () => {
        const sum =
          HOMEREADY_WEIGHTS.affordability +
          HOMEREADY_WEIGHTS.market_timing +
          HOMEREADY_WEIGHTS.stability +
          HOMEREADY_WEIGHTS.growth_potential +
          HOMEREADY_WEIGHTS.livability;

        // Using string comparison for exact precision
        expect(sum.toString()).toBe('1');
      });
    });

    describe('weight hierarchy', () => {
      it('affordability has the highest weight', () => {
        const max = Math.max(...Object.values(HOMEREADY_WEIGHTS));
        expect(HOMEREADY_WEIGHTS.affordability).toBe(max);
      });

      it('livability has the lowest weight', () => {
        const min = Math.min(...Object.values(HOMEREADY_WEIGHTS));
        expect(HOMEREADY_WEIGHTS.livability).toBe(min);
      });

      it('weights are in descending order: affordability > timing > stability > growth > livability', () => {
        expect(HOMEREADY_WEIGHTS.affordability).toBeGreaterThan(HOMEREADY_WEIGHTS.market_timing);
        expect(HOMEREADY_WEIGHTS.market_timing).toBeGreaterThan(HOMEREADY_WEIGHTS.stability);
        expect(HOMEREADY_WEIGHTS.stability).toBeGreaterThan(HOMEREADY_WEIGHTS.growth_potential);
        expect(HOMEREADY_WEIGHTS.growth_potential).toBeGreaterThan(HOMEREADY_WEIGHTS.livability);
      });
    });

    describe('weighted calculation verification', () => {
      it('calculates correct score for all components at 50', () => {
        const components: HomeReadyComponents = {
          affordability: 50,
          market_timing: 50,
          stability: 50,
          growth_potential: 50,
          livability: 50,
        };
        const expected = calculateExpectedHomeReady(components);
        expect(expected).toBe(50);
      });

      it('calculates correct score for all components at 100', () => {
        const components: HomeReadyComponents = {
          affordability: 100,
          market_timing: 100,
          stability: 100,
          growth_potential: 100,
          livability: 100,
        };
        const expected = calculateExpectedHomeReady(components);
        expect(expected).toBe(100);
      });

      it('calculates correct score for mixed components', () => {
        const components: HomeReadyComponents = {
          affordability: 80, // 80 × 0.30 = 24.0
          market_timing: 70, // 70 × 0.25 = 17.5
          stability: 60, // 60 × 0.20 = 12.0
          growth_potential: 50, // 50 × 0.15 = 7.5
          livability: 40, // 40 × 0.10 = 4.0
        };
        const expected = calculateExpectedHomeReady(components);
        // 24.0 + 17.5 + 12.0 + 7.5 + 4.0 = 65.0
        expect(expected).toBe(65);
      });

      it('affordability dominates when it differs most', () => {
        const highAffordability: HomeReadyComponents = {
          affordability: 100,
          market_timing: 50,
          stability: 50,
          growth_potential: 50,
          livability: 50,
        };
        const lowAffordability: HomeReadyComponents = {
          affordability: 0,
          market_timing: 50,
          stability: 50,
          growth_potential: 50,
          livability: 50,
        };
        const high = calculateExpectedHomeReady(highAffordability);
        const low = calculateExpectedHomeReady(lowAffordability);
        // Difference should be 30 points (0.30 weight × 100 difference)
        expect(high - low).toBe(30);
      });
    });
  });

  describe('InvestorEdge Weights', () => {
    describe('individual weights', () => {
      it('cash_flow weight is 0.35 (35%)', () => {
        expect(INVESTOREDGE_WEIGHTS.cash_flow).toBe(0.35);
      });

      it('rent_demand weight is 0.20 (20%)', () => {
        expect(INVESTOREDGE_WEIGHTS.rent_demand).toBe(0.2);
      });

      it('appreciation weight is 0.20 (20%)', () => {
        expect(INVESTOREDGE_WEIGHTS.appreciation).toBe(0.2);
      });

      it('entry_point weight is 0.15 (15%)', () => {
        expect(INVESTOREDGE_WEIGHTS.entry_point).toBe(0.15);
      });

      it('risk weight is 0.10 (10%)', () => {
        expect(INVESTOREDGE_WEIGHTS.risk).toBe(0.1);
      });
    });

    describe('weight sum', () => {
      it('all weights sum to exactly 1.0', () => {
        const sum = Object.values(INVESTOREDGE_WEIGHTS).reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1.0, WEIGHT_PRECISION);
      });

      it('weight sum is exactly 1.0 (high precision)', () => {
        const sum =
          INVESTOREDGE_WEIGHTS.cash_flow +
          INVESTOREDGE_WEIGHTS.rent_demand +
          INVESTOREDGE_WEIGHTS.appreciation +
          INVESTOREDGE_WEIGHTS.entry_point +
          INVESTOREDGE_WEIGHTS.risk;

        expect(sum.toString()).toBe('1');
      });
    });

    describe('weight hierarchy', () => {
      it('cash_flow has the highest weight', () => {
        const max = Math.max(...Object.values(INVESTOREDGE_WEIGHTS));
        expect(INVESTOREDGE_WEIGHTS.cash_flow).toBe(max);
      });

      it('risk has the lowest weight', () => {
        const min = Math.min(...Object.values(INVESTOREDGE_WEIGHTS));
        expect(INVESTOREDGE_WEIGHTS.risk).toBe(min);
      });

      it('rent_demand and appreciation have equal weights', () => {
        expect(INVESTOREDGE_WEIGHTS.rent_demand).toBe(INVESTOREDGE_WEIGHTS.appreciation);
      });
    });

    describe('weighted calculation verification', () => {
      it('calculates correct score for all components at 50', () => {
        const components: InvestorEdgeComponents = {
          cash_flow: 50,
          rent_demand: 50,
          appreciation: 50,
          entry_point: 50,
          risk: 50,
        };
        const expected = calculateExpectedInvestorEdge(components);
        expect(expected).toBe(50);
      });

      it('calculates correct score for mixed components', () => {
        const components: InvestorEdgeComponents = {
          cash_flow: 80, // 80 × 0.35 = 28.0
          rent_demand: 70, // 70 × 0.20 = 14.0
          appreciation: 60, // 60 × 0.20 = 12.0
          entry_point: 50, // 50 × 0.15 = 7.5
          risk: 40, // 40 × 0.10 = 4.0
        };
        const expected = calculateExpectedInvestorEdge(components);
        // 28.0 + 14.0 + 12.0 + 7.5 + 4.0 = 65.5
        expect(expected).toBe(65.5);
      });

      it('cash_flow dominates when it differs most', () => {
        const highCashFlow: InvestorEdgeComponents = {
          cash_flow: 100,
          rent_demand: 50,
          appreciation: 50,
          entry_point: 50,
          risk: 50,
        };
        const lowCashFlow: InvestorEdgeComponents = {
          cash_flow: 0,
          rent_demand: 50,
          appreciation: 50,
          entry_point: 50,
          risk: 50,
        };
        const high = calculateExpectedInvestorEdge(highCashFlow);
        const low = calculateExpectedInvestorEdge(lowCashFlow);
        // Difference should be 35 points (0.35 weight × 100 difference)
        expect(high - low).toBe(35);
      });
    });
  });

  describe('Market Health Weights', () => {
    describe('individual weights', () => {
      it('demand_strength weight is 0.35 (35%)', () => {
        expect(MARKET_HEALTH_WEIGHTS.demand_strength).toBe(0.35);
      });

      it('supply_balance weight is 0.25 (25%)', () => {
        expect(MARKET_HEALTH_WEIGHTS.supply_balance).toBe(0.25);
      });

      it('price_stability weight is 0.25 (25%)', () => {
        expect(MARKET_HEALTH_WEIGHTS.price_stability).toBe(0.25);
      });

      it('economic_foundation weight is 0.15 (15%)', () => {
        expect(MARKET_HEALTH_WEIGHTS.economic_foundation).toBe(0.15);
      });
    });

    describe('weight sum', () => {
      it('all weights sum to exactly 1.0', () => {
        const sum = Object.values(MARKET_HEALTH_WEIGHTS).reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1.0, WEIGHT_PRECISION);
      });

      it('weight sum is exactly 1.0 (high precision)', () => {
        const sum =
          MARKET_HEALTH_WEIGHTS.demand_strength +
          MARKET_HEALTH_WEIGHTS.supply_balance +
          MARKET_HEALTH_WEIGHTS.price_stability +
          MARKET_HEALTH_WEIGHTS.economic_foundation;

        expect(sum.toString()).toBe('1');
      });
    });

    describe('weight hierarchy', () => {
      it('demand_strength has the highest weight', () => {
        const max = Math.max(...Object.values(MARKET_HEALTH_WEIGHTS));
        expect(MARKET_HEALTH_WEIGHTS.demand_strength).toBe(max);
      });

      it('economic_foundation has the lowest weight', () => {
        const min = Math.min(...Object.values(MARKET_HEALTH_WEIGHTS));
        expect(MARKET_HEALTH_WEIGHTS.economic_foundation).toBe(min);
      });

      it('supply_balance and price_stability have equal weights', () => {
        expect(MARKET_HEALTH_WEIGHTS.supply_balance).toBe(MARKET_HEALTH_WEIGHTS.price_stability);
      });
    });

    describe('weighted calculation verification', () => {
      it('calculates correct score for all components at 50', () => {
        const components: MarketHealthComponents = {
          demand_strength: 50,
          supply_balance: 50,
          price_stability: 50,
          economic_foundation: 50,
        };
        const expected = calculateExpectedMarketHealth(components);
        expect(expected).toBe(50);
      });

      it('calculates correct score for mixed components', () => {
        const components: MarketHealthComponents = {
          demand_strength: 80, // 80 × 0.35 = 28.0
          supply_balance: 70, // 70 × 0.25 = 17.5
          price_stability: 60, // 60 × 0.25 = 15.0
          economic_foundation: 50, // 50 × 0.15 = 7.5
        };
        const expected = calculateExpectedMarketHealth(components);
        // 28.0 + 17.5 + 15.0 + 7.5 = 68.0
        expect(expected).toBe(68);
      });

      it('demand_strength dominates when it differs most', () => {
        const highDemand: MarketHealthComponents = {
          demand_strength: 100,
          supply_balance: 50,
          price_stability: 50,
          economic_foundation: 50,
        };
        const lowDemand: MarketHealthComponents = {
          demand_strength: 0,
          supply_balance: 50,
          price_stability: 50,
          economic_foundation: 50,
        };
        const high = calculateExpectedMarketHealth(highDemand);
        const low = calculateExpectedMarketHealth(lowDemand);
        // Difference should be 35 points (0.35 weight × 100 difference)
        expect(high - low).toBe(35);
      });
    });
  });

  describe('Cross-Score Weight Validation', () => {
    it('validates all weight sums using fixture helper', () => {
      // This should not throw
      expect(() => validateWeightSums()).not.toThrow();
    });

    it('all three score types have weights summing to 1.0', () => {
      const homeReadySum = Object.values(HOMEREADY_WEIGHTS).reduce((a, b) => a + b, 0);
      const investorEdgeSum = Object.values(INVESTOREDGE_WEIGHTS).reduce((a, b) => a + b, 0);
      const marketHealthSum = Object.values(MARKET_HEALTH_WEIGHTS).reduce((a, b) => a + b, 0);

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
      // Test extreme cases
      const minComponents: HomeReadyComponents = {
        affordability: 0,
        market_timing: 0,
        stability: 0,
        growth_potential: 0,
        livability: 0,
      };
      const maxComponents: HomeReadyComponents = {
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
      const minComponents: InvestorEdgeComponents = {
        cash_flow: 0,
        rent_demand: 0,
        appreciation: 0,
        entry_point: 0,
        risk: 0,
      };
      const maxComponents: InvestorEdgeComponents = {
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
      const minComponents: MarketHealthComponents = {
        demand_strength: 0,
        supply_balance: 0,
        price_stability: 0,
        economic_foundation: 0,
      };
      const maxComponents: MarketHealthComponents = {
        demand_strength: 100,
        supply_balance: 100,
        price_stability: 100,
        economic_foundation: 100,
      };

      expect(calculateExpectedMarketHealth(minComponents)).toBe(0);
      expect(calculateExpectedMarketHealth(maxComponents)).toBe(100);
    });
  });
});
