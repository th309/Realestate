/**
 * Per-Score-Type Weight Validation Unit Tests
 *
 * Verifies that scoring weights are correct and consistent for each score type:
 * 1. All weights sum to exactly 1.0 (100%)
 * 2. Individual weight values match documentation
 * 3. Weighted score calculation is correct
 *
 * Cross-score validation and bounds tests are in weight-cross-validation.spec.ts.
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
} from '../fixtures/expected-scores';

describe('Weight Validation', () => {
  const WEIGHT_PRECISION = 10;

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

      it('weights are in descending order', () => {
        expect(HOMEREADY_WEIGHTS.affordability).toBeGreaterThan(
          HOMEREADY_WEIGHTS.market_timing,
        );
        expect(HOMEREADY_WEIGHTS.market_timing).toBeGreaterThan(
          HOMEREADY_WEIGHTS.stability,
        );
        expect(HOMEREADY_WEIGHTS.stability).toBeGreaterThan(
          HOMEREADY_WEIGHTS.growth_potential,
        );
        expect(HOMEREADY_WEIGHTS.growth_potential).toBeGreaterThan(
          HOMEREADY_WEIGHTS.livability,
        );
      });
    });

    describe('weighted calculation verification', () => {
      it('calculates correct score for all components at 50', () => {
        const components: TestHomeReadyComponents = {
          affordability: 50,
          market_timing: 50,
          stability: 50,
          growth_potential: 50,
          livability: 50,
        };
        expect(calculateExpectedHomeReady(components)).toBe(50);
      });

      it('calculates correct score for all components at 100', () => {
        const components: TestHomeReadyComponents = {
          affordability: 100,
          market_timing: 100,
          stability: 100,
          growth_potential: 100,
          livability: 100,
        };
        expect(calculateExpectedHomeReady(components)).toBe(100);
      });

      it('calculates correct score for mixed components', () => {
        const components: TestHomeReadyComponents = {
          affordability: 80,
          market_timing: 70,
          stability: 60,
          growth_potential: 50,
          livability: 40,
        };
        // 24.0 + 17.5 + 12.0 + 7.5 + 4.0 = 65.0
        expect(calculateExpectedHomeReady(components)).toBe(65);
      });

      it('affordability dominates when it differs most', () => {
        const high: TestHomeReadyComponents = {
          affordability: 100,
          market_timing: 50,
          stability: 50,
          growth_potential: 50,
          livability: 50,
        };
        const low: TestHomeReadyComponents = {
          affordability: 0,
          market_timing: 50,
          stability: 50,
          growth_potential: 50,
          livability: 50,
        };
        expect(
          calculateExpectedHomeReady(high) - calculateExpectedHomeReady(low),
        ).toBe(30);
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
        const sum = Object.values(INVESTOREDGE_WEIGHTS).reduce(
          (a, b) => a + b,
          0,
        );
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
        expect(INVESTOREDGE_WEIGHTS.rent_demand).toBe(
          INVESTOREDGE_WEIGHTS.appreciation,
        );
      });
    });

    describe('weighted calculation verification', () => {
      it('calculates correct score for all components at 50', () => {
        const components: TestInvestorEdgeComponents = {
          cash_flow: 50,
          rent_demand: 50,
          appreciation: 50,
          entry_point: 50,
          risk: 50,
        };
        expect(calculateExpectedInvestorEdge(components)).toBe(50);
      });

      it('calculates correct score for mixed components', () => {
        const components: TestInvestorEdgeComponents = {
          cash_flow: 80,
          rent_demand: 70,
          appreciation: 60,
          entry_point: 50,
          risk: 40,
        };
        // 28.0 + 14.0 + 12.0 + 7.5 + 4.0 = 65.5
        expect(calculateExpectedInvestorEdge(components)).toBe(65.5);
      });

      it('cash_flow dominates when it differs most', () => {
        const high: TestInvestorEdgeComponents = {
          cash_flow: 100,
          rent_demand: 50,
          appreciation: 50,
          entry_point: 50,
          risk: 50,
        };
        const low: TestInvestorEdgeComponents = {
          cash_flow: 0,
          rent_demand: 50,
          appreciation: 50,
          entry_point: 50,
          risk: 50,
        };
        expect(
          calculateExpectedInvestorEdge(high) -
            calculateExpectedInvestorEdge(low),
        ).toBe(35);
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
        const sum = Object.values(MARKET_HEALTH_WEIGHTS).reduce(
          (a, b) => a + b,
          0,
        );
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
        expect(MARKET_HEALTH_WEIGHTS.supply_balance).toBe(
          MARKET_HEALTH_WEIGHTS.price_stability,
        );
      });
    });

    describe('weighted calculation verification', () => {
      it('calculates correct score for all components at 50', () => {
        const components: TestMarketHealthComponents = {
          demand_strength: 50,
          supply_balance: 50,
          price_stability: 50,
          economic_foundation: 50,
        };
        expect(calculateExpectedMarketHealth(components)).toBe(50);
      });

      it('calculates correct score for mixed components', () => {
        const components: TestMarketHealthComponents = {
          demand_strength: 80,
          supply_balance: 70,
          price_stability: 60,
          economic_foundation: 50,
        };
        // 28.0 + 17.5 + 15.0 + 7.5 = 68.0
        expect(calculateExpectedMarketHealth(components)).toBe(68);
      });

      it('demand_strength dominates when it differs most', () => {
        const high: TestMarketHealthComponents = {
          demand_strength: 100,
          supply_balance: 50,
          price_stability: 50,
          economic_foundation: 50,
        };
        const low: TestMarketHealthComponents = {
          demand_strength: 0,
          supply_balance: 50,
          price_stability: 50,
          economic_foundation: 50,
        };
        expect(
          calculateExpectedMarketHealth(high) -
            calculateExpectedMarketHealth(low),
        ).toBe(35);
      });
    });
  });
});
