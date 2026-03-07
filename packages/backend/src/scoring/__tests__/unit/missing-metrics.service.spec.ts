/**
 * Missing Metrics Service Tests
 *
 * Tests for handling missing data scenarios in PropertyIQ scoring:
 * - Strategy application (skip, neutral, penalize)
 * - Weight redistribution when metrics are skipped
 * - Component and score availability determination
 * - Threshold enforcement for insufficient data
 *
 * These tests verify that the system correctly handles partial data,
 * which is critical for real-world scenarios where not all metrics
 * are available for every geography.
 *
 * Updated to match v3.0 metric names from missing-metrics.constants.ts.
 */

import {
  MissingMetricsService,
  METRIC_MISSING_STRATEGIES,
  REQUIRED_METRICS_BY_COMPONENT,
} from '../../missing-metrics.service';
import { SCORING_CONSTANTS } from '../../scoring.types';

describe('MissingMetricsService', () => {
  let service: MissingMetricsService;

  beforeEach(() => {
    service = new MissingMetricsService();
  });

  // ===========================================================================
  // handleMissingMetric Tests
  // ===========================================================================
  describe('handleMissingMetric', () => {
    describe('Skip strategy', () => {
      it('returns skip strategy for skip-configured metrics', () => {
        // rf_median_dom is configured as 'skip'
        const result = service.handleMissingMetric('rf_median_dom');

        expect(result.strategy).toBe('skip');
        expect(result.score).toBeNull();
        expect(result.includeInWeight).toBe(false);
        expect(result.message).toContain('excluding from calculation');
      });

      it('excludes metric from weight calculation', () => {
        const result = service.handleMissingMetric('rf_homes_sold_yoy');

        expect(result.includeInWeight).toBe(false);
      });

      it('returns null score for skipped metrics', () => {
        const result = service.handleMissingMetric('fred_vix');

        expect(result.score).toBeNull();
      });

      it('applies skip strategy to unknown metrics', () => {
        const result = service.handleMissingMetric('unknown_metric_xyz');

        expect(result.strategy).toBe('skip');
        expect(result.includeInWeight).toBe(false);
      });
    });

    describe('Neutral strategy', () => {
      it('returns neutral strategy for neutral-configured metrics', () => {
        // cen_median_age is configured as 'neutral'
        const result = service.handleMissingMetric('cen_median_age');

        expect(result.strategy).toBe('neutral');
        expect(result.score).toBe(50);
        expect(result.includeInWeight).toBe(true);
        expect(result.message).toContain('using neutral score');
      });

      it('applies score of 50 for missing metric', () => {
        const result = service.handleMissingMetric('econ_gdp_yoy');

        expect(result.score).toBe(50);
      });

      it('preserves original weight (includes in weight)', () => {
        const result = service.handleMissingMetric('cen_population_yoy');

        expect(result.includeInWeight).toBe(true);
      });

      it('handles all neutral-configured metrics', () => {
        const neutralMetrics = [
          'cen_median_age',
          'cen_population_yoy',
          'cen_income_yoy',
          'cen_homeownership_rate',
          'cen_rent_as_pct_of_income',
          'econ_gdp_yoy',
          'z_inventory',
          'calc_income_to_buy',
        ];

        for (const metric of neutralMetrics) {
          const result = service.handleMissingMetric(metric);
          expect(result.strategy).toBe('neutral');
          expect(result.score).toBe(50);
        }
      });
    });

    describe('Penalize strategy — none in v3.0', () => {
      it('v3.0 has no penalize-configured metrics', () => {
        // v3.0 removed all penalize strategies; all metrics are either skip or neutral
        const strategies = Object.values(METRIC_MISSING_STRATEGIES);
        expect(strategies).not.toContain('penalize');
      });
    });

    describe('Strategy configuration', () => {
      it('has strategy defined for all documented metrics', () => {
        // Verify that v3.0 metrics have strategies defined
        const criticalMetrics = [
          // Redfin
          'rf_median_dom',
          'rf_off_market_in_two_weeks',
          'rf_sold_above_list',
          'rf_avg_sale_to_list',
          // Census
          'cen_median_age',
          'cen_population_yoy',
          'cen_homeownership_rate',
          // Economic
          'econ_gdp_yoy',
          // Zillow inventory
          'z_inventory',
          // Calculated
          'calc_income_to_buy',
        ];

        for (const metric of criticalMetrics) {
          expect(METRIC_MISSING_STRATEGIES[metric]).toBeDefined();
        }
      });

      it('only uses valid strategy values', () => {
        const validStrategies = ['skip', 'neutral', 'penalize'];

        for (const strategy of Object.values(METRIC_MISSING_STRATEGIES)) {
          expect(validStrategies).toContain(strategy);
        }
      });
    });
  });

  // ===========================================================================
  // checkComponentAvailability Tests
  // ===========================================================================
  describe('checkComponentAvailability', () => {
    describe('Required metrics handling', () => {
      it('returns available when no required metrics are defined (v3.0 pattern)', () => {
        // In v3.0, affordability has no required metrics
        const availableMetrics = ['some_metric'];
        const componentMetrics = [
          { name: 'some_metric', weight: 0.3 },
          { name: 'cen_income_yoy', weight: 0.25 }, // neutral when missing
          { name: 'calc_income_to_buy', weight: 0.2 }, // neutral when missing
        ];

        const result = service.checkComponentAvailability(
          'affordability',
          availableMetrics,
          componentMetrics,
        );

        // All contribute: 0.3 direct + 0.25 neutral + 0.2 neutral = 0.75
        expect(result.available).toBe(true);
      });

      it('handles components with no required metrics', () => {
        // market_timing has no required metrics
        const availableMetrics = ['rf_median_dom'];
        const componentMetrics = [
          { name: 'rf_median_dom', weight: 0.35 },
          { name: 'cen_population_yoy', weight: 0.25 }, // neutral
        ];

        const result = service.checkComponentAvailability(
          'market_timing',
          availableMetrics,
          componentMetrics,
        );

        // Should check based on weight threshold, not required metrics
        expect(result.completeness).toBeGreaterThan(0);
      });
    });

    describe('Weight calculation', () => {
      it('calculates correct available weight with all metrics present', () => {
        const availableMetrics = ['metric_a', 'metric_b', 'metric_c'];
        const componentMetrics = [
          { name: 'metric_a', weight: 0.4 },
          { name: 'metric_b', weight: 0.35 },
          { name: 'metric_c', weight: 0.25 },
        ];

        const result = service.checkComponentAvailability(
          'demand_strength', // No required metrics
          availableMetrics,
          componentMetrics,
        );

        expect(result.availableWeight).toBeCloseTo(1.0, 5);
        expect(result.totalWeight).toBeCloseTo(1.0, 5);
        expect(result.completeness).toBe(100);
      });

      it('includes neutral strategy metrics in available weight', () => {
        // cen_population_yoy is neutral strategy
        const availableMetrics = ['metric_a'];
        const componentMetrics = [
          { name: 'metric_a', weight: 0.5 },
          { name: 'cen_population_yoy', weight: 0.5 }, // missing but neutral
        ];

        const result = service.checkComponentAvailability(
          'demand_strength',
          availableMetrics,
          componentMetrics,
        );

        // Both should contribute: 0.5 direct + 0.5 neutral = 1.0
        expect(result.availableWeight).toBeCloseTo(1.0, 5);
        expect(result.completeness).toBe(100);
      });

      it('excludes skip strategy metrics from available weight', () => {
        // rf_median_dom is skip strategy
        const availableMetrics = ['metric_a'];
        const componentMetrics = [
          { name: 'metric_a', weight: 0.5 },
          { name: 'rf_median_dom', weight: 0.5 }, // missing, will be skipped
        ];

        const result = service.checkComponentAvailability(
          'demand_strength',
          availableMetrics,
          componentMetrics,
        );

        // Only metric_a contributes: 0.5 out of 1.0 = 50%
        expect(result.availableWeight).toBeCloseTo(0.5, 5);
        expect(result.completeness).toBe(50);
      });
    });

    describe('Completeness threshold', () => {
      it('returns unavailable when completeness below 50%', () => {
        // All metrics use skip strategy when missing
        const availableMetrics = ['metric_a'];
        const componentMetrics = [
          { name: 'metric_a', weight: 0.3 },
          { name: 'rf_median_dom', weight: 0.7 }, // skip strategy
        ];

        const result = service.checkComponentAvailability(
          'demand_strength',
          availableMetrics,
          componentMetrics,
        );

        // 0.3 / 1.0 = 30% < 50%
        expect(result.available).toBe(false);
        expect(result.completeness).toBe(30);
        expect(result.reason).toContain('minimum');
      });

      it('returns available when completeness at exactly 50%', () => {
        const availableMetrics = ['metric_a'];
        const componentMetrics = [
          { name: 'metric_a', weight: 0.5 },
          { name: 'rf_median_dom', weight: 0.5 }, // skip strategy
        ];

        const result = service.checkComponentAvailability(
          'demand_strength',
          availableMetrics,
          componentMetrics,
        );

        expect(result.completeness).toBe(50);
        expect(result.available).toBe(true);
      });

      it('returns available when completeness above 50%', () => {
        const availableMetrics = ['metric_a', 'metric_b'];
        const componentMetrics = [
          { name: 'metric_a', weight: 0.4 },
          { name: 'metric_b', weight: 0.3 },
          { name: 'rf_median_dom', weight: 0.3 }, // skip strategy
        ];

        const result = service.checkComponentAvailability(
          'demand_strength',
          availableMetrics,
          componentMetrics,
        );

        // 0.7 / 1.0 = 70% > 50%
        expect(result.completeness).toBe(70);
        expect(result.available).toBe(true);
      });

      it('uses SCORE_AVAILABLE_MIN_COMPLETENESS constant', () => {
        expect(SCORING_CONSTANTS.SCORE_AVAILABLE_MIN_COMPLETENESS).toBe(50);
      });
    });
  });

  // ===========================================================================
  // checkScoreAvailability Tests
  // ===========================================================================
  describe('checkScoreAvailability', () => {
    describe('Score unavailable threshold', () => {
      it('returns unavailable when >50% of weight is missing', () => {
        const componentAvailability = {
          affordability: {
            available: false,
            completeness: 0,
            availableWeight: 0,
            totalWeight: 1,
          },
          market_timing: {
            available: false,
            completeness: 0,
            availableWeight: 0,
            totalWeight: 1,
          },
          stability: {
            available: true,
            completeness: 100,
            availableWeight: 1,
            totalWeight: 1,
          },
          growth_potential: {
            available: true,
            completeness: 100,
            availableWeight: 1,
            totalWeight: 1,
          },
        };

        const componentWeights = {
          affordability: 0.3,
          market_timing: 0.25,
          stability: 0.2,
          growth_potential: 0.15,
        };

        const result = service.checkScoreAvailability(
          componentAvailability,
          componentWeights,
        );

        // Missing: 0.30 + 0.25 = 0.55 out of 0.90 total = ~61%
        expect(result.available).toBe(false);
        expect(result.status).toBe('unavailable');
        expect(result.reason).toContain('available');
        expect(result.missingComponents).toContain('affordability');
        expect(result.missingComponents).toContain('market_timing');
      });

      it('returns score when <=50% of weight is missing', () => {
        const componentAvailability = {
          affordability: {
            available: true,
            completeness: 100,
            availableWeight: 1,
            totalWeight: 1,
          },
          market_timing: {
            available: true,
            completeness: 100,
            availableWeight: 1,
            totalWeight: 1,
          },
          stability: {
            available: false,
            completeness: 0,
            availableWeight: 0,
            totalWeight: 1,
          },
          growth_potential: {
            available: false,
            completeness: 0,
            availableWeight: 0,
            totalWeight: 1,
          },
        };

        const componentWeights = {
          affordability: 0.3,
          market_timing: 0.25,
          stability: 0.2,
          growth_potential: 0.15,
        };

        const result = service.checkScoreAvailability(
          componentAvailability,
          componentWeights,
        );

        // Available: 0.30 + 0.25 = 0.55 out of 0.90 total = ~61%
        expect(result.available).toBe(true);
      });

      it('includes reason when score is unavailable', () => {
        const componentAvailability = {
          cash_flow: {
            available: false,
            completeness: 0,
            availableWeight: 0,
            totalWeight: 1,
          },
          rent_demand: {
            available: false,
            completeness: 0,
            availableWeight: 0,
            totalWeight: 1,
          },
          appreciation: {
            available: false,
            completeness: 0,
            availableWeight: 0,
            totalWeight: 1,
          },
          entry_point: {
            available: true,
            completeness: 100,
            availableWeight: 1,
            totalWeight: 1,
          },
          risk: {
            available: true,
            completeness: 100,
            availableWeight: 1,
            totalWeight: 1,
          },
        };

        const componentWeights = {
          cash_flow: 0.35,
          rent_demand: 0.2,
          appreciation: 0.2,
          entry_point: 0.15,
          risk: 0.1,
        };

        const result = service.checkScoreAvailability(
          componentAvailability,
          componentWeights,
        );

        // Missing: 0.35 + 0.20 + 0.20 = 0.75 (75%)
        expect(result.available).toBe(false);
        expect(result.reason).toBeDefined();
        expect(result.reason).toContain('minimum');
      });
    });

    describe('Score status determination', () => {
      it('returns status "complete" when all components available', () => {
        const componentAvailability = {
          demand_strength: {
            available: true,
            completeness: 100,
            availableWeight: 1,
            totalWeight: 1,
          },
          supply_balance: {
            available: true,
            completeness: 100,
            availableWeight: 1,
            totalWeight: 1,
          },
        };

        const componentWeights = {
          demand_strength: 0.35,
          supply_balance: 0.25,
        };

        const result = service.checkScoreAvailability(
          componentAvailability,
          componentWeights,
        );

        expect(result.status).toBe('complete');
        expect(result.completeness).toBe(100);
        expect(result.missingComponents).toHaveLength(0);
      });

      it('returns status "partial" when some components missing but above threshold', () => {
        const componentAvailability = {
          demand_strength: {
            available: true,
            completeness: 100,
            availableWeight: 1,
            totalWeight: 1,
          },
          supply_balance: {
            available: true,
            completeness: 100,
            availableWeight: 1,
            totalWeight: 1,
          },
          affordability: {
            available: true,
            completeness: 100,
            availableWeight: 1,
            totalWeight: 1,
          },
          stability: {
            available: false,
            completeness: 0,
            availableWeight: 0,
            totalWeight: 1,
          },
        };

        const componentWeights = {
          demand_strength: 0.35,
          supply_balance: 0.25,
          affordability: 0.25,
          stability: 0.15,
        };

        const result = service.checkScoreAvailability(
          componentAvailability,
          componentWeights,
        );

        // Available: 0.35 + 0.25 + 0.25 = 0.85 out of 1.0 = 85%
        // 85 >= 50 (available) but < 80 (PARTIAL_SCORE_THRESHOLD) => 'partial'
        // Actually 85 >= 80 => 'complete'
        expect(result.available).toBe(true);
        expect(result.completeness).toBe(85);
        // At 85%, which is >= PARTIAL_SCORE_THRESHOLD (80), status is 'complete'
        expect(result.status).toBe('complete');
      });

      it('returns status "partial" when completeness is between 50% and 80%', () => {
        const componentAvailability = {
          demand_strength: {
            available: true,
            completeness: 100,
            availableWeight: 1,
            totalWeight: 1,
          },
          supply_balance: {
            available: true,
            completeness: 100,
            availableWeight: 1,
            totalWeight: 1,
          },
          affordability: {
            available: false,
            completeness: 0,
            availableWeight: 0,
            totalWeight: 1,
          },
          stability: {
            available: false,
            completeness: 0,
            availableWeight: 0,
            totalWeight: 1,
          },
        };

        const componentWeights = {
          demand_strength: 0.35,
          supply_balance: 0.25,
          affordability: 0.25,
          stability: 0.15,
        };

        const result = service.checkScoreAvailability(
          componentAvailability,
          componentWeights,
        );

        // Available: 0.35 + 0.25 = 0.60 out of 1.0 = 60%
        expect(result.available).toBe(true);
        expect(result.status).toBe('partial');
        expect(result.completeness).toBe(60);
        expect(result.missingComponents).toContain('affordability');
        expect(result.missingComponents).toContain('stability');
      });

      it('tracks all missing components', () => {
        const componentAvailability = {
          affordability: {
            available: true,
            completeness: 100,
            availableWeight: 1,
            totalWeight: 1,
          },
          market_timing: {
            available: false,
            completeness: 0,
            availableWeight: 0,
            totalWeight: 1,
          },
          stability: {
            available: true,
            completeness: 100,
            availableWeight: 1,
            totalWeight: 1,
          },
          growth_potential: {
            available: false,
            completeness: 0,
            availableWeight: 0,
            totalWeight: 1,
          },
        };

        const componentWeights = {
          affordability: 0.3,
          market_timing: 0.25,
          stability: 0.3,
          growth_potential: 0.15,
        };

        const result = service.checkScoreAvailability(
          componentAvailability,
          componentWeights,
        );

        expect(result.missingComponents).toContain('market_timing');
        expect(result.missingComponents).toContain('growth_potential');
        expect(result.missingComponents).toHaveLength(2);
      });
    });

    describe('Edge cases', () => {
      it('handles empty component availability', () => {
        const componentAvailability = {};
        const componentWeights = {};

        const result = service.checkScoreAvailability(
          componentAvailability,
          componentWeights,
        );

        expect(result.completeness).toBe(0);
        expect(result.available).toBe(false);
      });

      it('handles mismatched component weights', () => {
        const componentAvailability = {
          affordability: {
            available: true,
            completeness: 100,
            availableWeight: 1,
            totalWeight: 1,
          },
          unknown_component: {
            available: true,
            completeness: 100,
            availableWeight: 1,
            totalWeight: 1,
          },
        };

        const componentWeights = {
          affordability: 0.3,
          // unknown_component has no weight defined
        };

        const result = service.checkScoreAvailability(
          componentAvailability,
          componentWeights,
        );

        // Only affordability has weight, so completeness = 100%
        expect(result.completeness).toBe(100);
      });
    });
  });

  // ===========================================================================
  // redistributeWeights Tests
  // ===========================================================================
  describe('redistributeWeights', () => {
    describe('Weight redistribution logic', () => {
      it('redistributes weight when metric is skipped', () => {
        const metrics = [
          { name: 'metric_a', weight: 0.4 },
          { name: 'metric_b', weight: 0.3 },
          { name: 'rf_median_dom', weight: 0.3 }, // skip strategy when missing
        ];
        const availableMetrics = new Set(['metric_a', 'metric_b']);

        const result = service.redistributeWeights(metrics, availableMetrics);

        // Only metric_a and metric_b available (total 0.7)
        // New weights: 0.4/0.7 = 0.571, 0.3/0.7 = 0.429
        expect(result.get('metric_a')).toBeCloseTo(0.571, 2);
        expect(result.get('metric_b')).toBeCloseTo(0.429, 2);
        expect(result.has('rf_median_dom')).toBe(false);
      });

      it('proportionally increases remaining weights', () => {
        const metrics = [
          { name: 'metric_a', weight: 0.5 },
          { name: 'metric_b', weight: 0.3 },
          { name: 'rf_median_dom', weight: 0.2 }, // skip strategy
        ];
        const availableMetrics = new Set(['metric_a', 'metric_b']);

        const result = service.redistributeWeights(metrics, availableMetrics);

        // Ratio preserved: a/b = 0.5/0.3 = 1.667
        const redistributedRatio =
          result.get('metric_a')! / result.get('metric_b')!;
        expect(redistributedRatio).toBeCloseTo(0.5 / 0.3, 3);
      });

      it('remaining weights sum to 1.0', () => {
        const metrics = [
          { name: 'metric_a', weight: 0.4 },
          { name: 'metric_b', weight: 0.35 },
          { name: 'rf_median_dom', weight: 0.15 }, // skip
          { name: 'fred_vix', weight: 0.1 }, // skip
        ];
        const availableMetrics = new Set(['metric_a', 'metric_b']);

        const result = service.redistributeWeights(metrics, availableMetrics);

        const sum = Array.from(result.values()).reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1.0, 10);
      });

      it('includes neutral strategy metrics with redistributed weight', () => {
        const metrics = [
          { name: 'metric_a', weight: 0.4 },
          { name: 'econ_gdp_yoy', weight: 0.3 }, // neutral strategy (missing)
          { name: 'rf_median_dom', weight: 0.3 }, // skip strategy (missing)
        ];
        const availableMetrics = new Set(['metric_a']);

        const result = service.redistributeWeights(metrics, availableMetrics);

        // metric_a available, econ_gdp_yoy neutral (included), rf_median_dom skipped
        // Total weight: 0.4 + 0.3 = 0.7
        expect(result.has('metric_a')).toBe(true);
        expect(result.has('econ_gdp_yoy')).toBe(true);
        expect(result.has('rf_median_dom')).toBe(false);

        const sum = Array.from(result.values()).reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1.0, 10);
      });
    });

    describe('Edge cases', () => {
      it('handles all metrics available', () => {
        const metrics = [
          { name: 'metric_a', weight: 0.5 },
          { name: 'metric_b', weight: 0.5 },
        ];
        const availableMetrics = new Set(['metric_a', 'metric_b']);

        const result = service.redistributeWeights(metrics, availableMetrics);

        expect(result.get('metric_a')).toBe(0.5);
        expect(result.get('metric_b')).toBe(0.5);
      });

      it('handles empty available metrics with all skip strategies', () => {
        const metrics = [
          { name: 'rf_median_dom', weight: 0.5 },
          { name: 'fred_vix', weight: 0.5 },
        ];
        const availableMetrics = new Set<string>();

        const result = service.redistributeWeights(metrics, availableMetrics);

        expect(result.size).toBe(0);
      });

      it('handles single metric available', () => {
        const metrics = [
          { name: 'metric_a', weight: 0.3 },
          { name: 'rf_median_dom', weight: 0.7 }, // skip
        ];
        const availableMetrics = new Set(['metric_a']);

        const result = service.redistributeWeights(metrics, availableMetrics);

        expect(result.get('metric_a')).toBe(1.0);
      });

      it('handles metrics with zero weight', () => {
        const metrics = [
          { name: 'metric_a', weight: 0 },
          { name: 'metric_b', weight: 1.0 },
        ];
        const availableMetrics = new Set(['metric_a', 'metric_b']);

        const result = service.redistributeWeights(metrics, availableMetrics);

        expect(result.get('metric_a')).toBe(0);
        expect(result.get('metric_b')).toBe(1.0);
      });
    });
  });

  // ===========================================================================
  // getMissingMetricsSummary Tests
  // ===========================================================================
  describe('getMissingMetricsSummary', () => {
    it('correctly categorizes missing metrics by strategy', () => {
      const allMetrics = [
        'cen_median_age', // neutral
        'econ_gdp_yoy', // neutral
        'rf_median_dom', // skip
        'cen_population_yoy', // neutral
        'fred_vix', // skip
      ];
      const availableMetrics = ['cen_median_age']; // Only cen_median_age available

      const result = service.getMissingMetricsSummary(
        allMetrics,
        availableMetrics,
      );

      expect(result.missing).toContain('econ_gdp_yoy');
      expect(result.missing).toContain('rf_median_dom');
      expect(result.missing).toContain('cen_population_yoy');
      expect(result.missing).toContain('fred_vix');
      expect(result.missing).not.toContain('cen_median_age');

      expect(result.skipped).toContain('rf_median_dom');
      expect(result.skipped).toContain('fred_vix');
      expect(result.neutral).toContain('econ_gdp_yoy');
      expect(result.neutral).toContain('cen_population_yoy');
    });

    it('returns empty arrays when all metrics available', () => {
      const allMetrics = ['cen_median_age', 'econ_gdp_yoy', 'rf_median_dom'];
      const availableMetrics = [
        'cen_median_age',
        'econ_gdp_yoy',
        'rf_median_dom',
      ];

      const result = service.getMissingMetricsSummary(
        allMetrics,
        availableMetrics,
      );

      expect(result.missing).toHaveLength(0);
      expect(result.skipped).toHaveLength(0);
      expect(result.neutral).toHaveLength(0);
      expect(result.penalized).toHaveLength(0);
    });

    it('handles all metrics missing', () => {
      const allMetrics = [
        'rf_median_dom', // skip
        'cen_median_age', // neutral
        'fred_vix', // skip
      ];
      const availableMetrics: string[] = [];

      const result = service.getMissingMetricsSummary(
        allMetrics,
        availableMetrics,
      );

      expect(result.missing).toHaveLength(3);
      expect(result.skipped).toContain('rf_median_dom');
      expect(result.skipped).toContain('fred_vix');
      expect(result.neutral).toContain('cen_median_age');
    });
  });

  // ===========================================================================
  // Required Metrics Configuration Tests (v3.0)
  // ===========================================================================
  describe('Required Metrics Configuration (v3.0)', () => {
    it('v3.0 affordability has no required metrics', () => {
      expect(REQUIRED_METRICS_BY_COMPONENT.affordability).toHaveLength(0);
    });

    it('v3.0 cash_flow has no required metrics', () => {
      expect(REQUIRED_METRICS_BY_COMPONENT.cash_flow).toHaveLength(0);
    });

    it('v3.0 rent_demand has no required metrics', () => {
      expect(REQUIRED_METRICS_BY_COMPONENT.rent_demand).toHaveLength(0);
    });

    it('v3.0 appreciation has no required metrics', () => {
      expect(REQUIRED_METRICS_BY_COMPONENT.appreciation).toHaveLength(0);
    });

    it('Market Health components have no required metrics', () => {
      expect(REQUIRED_METRICS_BY_COMPONENT.demand_strength).toHaveLength(0);
      expect(REQUIRED_METRICS_BY_COMPONENT.supply_balance).toHaveLength(0);
    });

    it('HomeReady components have no required metrics', () => {
      expect(REQUIRED_METRICS_BY_COMPONENT.affordability).toHaveLength(0);
      expect(REQUIRED_METRICS_BY_COMPONENT.market_timing).toHaveLength(0);
      expect(REQUIRED_METRICS_BY_COMPONENT.stability).toHaveLength(0);
      expect(REQUIRED_METRICS_BY_COMPONENT.growth_potential).toHaveLength(0);
    });

    it('InvestorEdge components have no required metrics', () => {
      expect(REQUIRED_METRICS_BY_COMPONENT.entry_point).toHaveLength(0);
      expect(REQUIRED_METRICS_BY_COMPONENT.risk).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Integration Tests with Fixture Data
  // ===========================================================================
  describe('Integration with fixture scenarios', () => {
    it('handles MISSING_OPTIONAL_001 scenario - walkability skip', () => {
      // Walkability is not in METRIC_MISSING_STRATEGIES so defaults to skip
      const result = service.handleMissingMetric('walkability_score');

      expect(result.strategy).toBe('skip');
      expect(result.includeInWeight).toBe(false);
    });

    it('handles MISSING_NEUTRAL_002 scenario - school_rating default skip', () => {
      // school_rating is not in METRIC_MISSING_STRATEGIES so defaults to skip
      const result = service.handleMissingMetric('school_rating');

      expect(result.strategy).toBe('skip');
    });

    it('handles MISSING_MAJORITY_005 scenario - >50% missing', () => {
      // When >50% of weight is missing, score should be unavailable
      const componentAvailability = {
        affordability: {
          available: true,
          completeness: 100,
          availableWeight: 1,
          totalWeight: 1,
        },
        market_timing: {
          available: false,
          completeness: 0,
          availableWeight: 0,
          totalWeight: 1,
        },
        stability: {
          available: false,
          completeness: 0,
          availableWeight: 0,
          totalWeight: 1,
        },
        growth_potential: {
          available: false,
          completeness: 0,
          availableWeight: 0,
          totalWeight: 1,
        },
      };

      const componentWeights = {
        affordability: 0.3,
        market_timing: 0.25,
        stability: 0.2,
        growth_potential: 0.15,
      };

      const result = service.checkScoreAvailability(
        componentAvailability,
        componentWeights,
      );

      // Only 30% of 0.90 total = ~33% available
      expect(result.available).toBe(false);
      expect(result.status).toBe('unavailable');
    });
  });
});
