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
 */

import { MissingMetricsService, METRIC_MISSING_STRATEGIES, REQUIRED_METRICS_BY_COMPONENT } from '../../missing-metrics.service';
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
        // hotness_score is configured as 'skip'
        const result = service.handleMissingMetric('hotness_score');

        expect(result.strategy).toBe('skip');
        expect(result.score).toBeNull();
        expect(result.includeInWeight).toBe(false);
        expect(result.message).toContain('excluding from calculation');
      });

      it('excludes metric from weight calculation', () => {
        const result = service.handleMissingMetric('new_listing_count_yy');

        expect(result.includeInWeight).toBe(false);
      });

      it('returns null score for skipped metrics', () => {
        const result = service.handleMissingMetric('employment_yoy');

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
        // pending_ratio is configured as 'neutral'
        const result = service.handleMissingMetric('pending_ratio');

        expect(result.strategy).toBe('neutral');
        expect(result.score).toBe(50);
        expect(result.includeInWeight).toBe(true);
        expect(result.message).toContain('using neutral score');
      });

      it('applies score of 50 for missing metric', () => {
        const result = service.handleMissingMetric('unemployment_rate');

        expect(result.score).toBe(50);
      });

      it('preserves original weight (includes in weight)', () => {
        const result = service.handleMissingMetric('median_days_on_market');

        expect(result.includeInWeight).toBe(true);
      });

      it('handles all neutral-configured metrics', () => {
        const neutralMetrics = [
          'pending_ratio',
          'median_days_on_market',
          'months_of_supply',
          'active_listing_count_yy',
          'price_reduced_share',
          'sale_to_list_ratio',
          'zhvi_yoy',
          'unemployment_rate',
        ];

        for (const metric of neutralMetrics) {
          const result = service.handleMissingMetric(metric);
          expect(result.strategy).toBe('neutral');
          expect(result.score).toBe(50);
        }
      });
    });

    describe('Penalize strategy', () => {
      it('returns penalize strategy for penalize-configured metrics', () => {
        // zhvi is configured as 'penalize'
        const result = service.handleMissingMetric('zhvi');

        expect(result.strategy).toBe('penalize');
        expect(result.score).toBe(25);
        expect(result.includeInWeight).toBe(true);
        expect(result.message).toContain('applying penalty score');
      });

      it('applies score of 25 for missing metric', () => {
        const result = service.handleMissingMetric('cap_rate');

        expect(result.score).toBe(25);
      });

      it('preserves original weight (includes in weight)', () => {
        const result = service.handleMissingMetric('zori');

        expect(result.includeInWeight).toBe(true);
      });

      it('handles all penalize-configured metrics', () => {
        const penalizeMetrics = ['zhvi', 'zori', 'cap_rate', 'cap_rate_proxy', 'grm', 'rent_yield'];

        for (const metric of penalizeMetrics) {
          const result = service.handleMissingMetric(metric);
          expect(result.strategy).toBe('penalize');
          expect(result.score).toBe(25);
        }
      });
    });

    describe('Strategy configuration', () => {
      it('has strategy defined for all documented metrics', () => {
        // Verify that critical metrics have strategies defined
        const criticalMetrics = [
          // Market Health
          'pending_ratio',
          'median_days_on_market',
          'hotness_score',
          'months_of_supply',
          // HomeReady
          'zhvi',
          'zori',
          'homeowner_income',
          // InvestorEdge
          'cap_rate',
          'grm',
          'rent_yield',
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
      it('returns unavailable if required metric is missing', () => {
        // affordability requires 'zhvi' and 'zori'
        const availableMetrics = ['homeowner_income', 'renter_income'];
        const componentMetrics = [
          { name: 'zhvi', weight: 0.3 },
          { name: 'zori', weight: 0.25 },
          { name: 'homeowner_income', weight: 0.2 },
          { name: 'renter_income', weight: 0.15 },
        ];

        const result = service.checkComponentAvailability(
          'affordability',
          availableMetrics,
          componentMetrics,
        );

        expect(result.available).toBe(false);
        expect(result.reason).toContain('Required metric');
        expect(result.reason).toContain('missing');
      });

      it('returns available if all required metrics present', () => {
        const availableMetrics = ['zhvi', 'zori'];
        const componentMetrics = [
          { name: 'zhvi', weight: 0.3 },
          { name: 'zori', weight: 0.25 },
          { name: 'homeowner_income', weight: 0.2 },
        ];

        const result = service.checkComponentAvailability(
          'affordability',
          availableMetrics,
          componentMetrics,
        );

        // With neutral handling, homeowner_income will contribute to available weight
        expect(result.available).toBe(true);
      });

      it('handles components with no required metrics', () => {
        // market_timing has no required metrics
        const availableMetrics = ['price_reduced_share'];
        const componentMetrics = [
          { name: 'price_reduced_share', weight: 0.35 },
          { name: 'median_days_on_market', weight: 0.25 },
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
        // median_days_on_market is neutral strategy
        const availableMetrics = ['metric_a'];
        const componentMetrics = [
          { name: 'metric_a', weight: 0.5 },
          { name: 'median_days_on_market', weight: 0.5 }, // missing but neutral
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
        // hotness_score is skip strategy
        const availableMetrics = ['metric_a'];
        const componentMetrics = [
          { name: 'metric_a', weight: 0.5 },
          { name: 'hotness_score', weight: 0.5 }, // missing, will be skipped
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
          { name: 'hotness_score', weight: 0.7 }, // skip strategy
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
          { name: 'hotness_score', weight: 0.5 }, // skip strategy
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
          { name: 'hotness_score', weight: 0.3 }, // skip strategy
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
          affordability: { available: false, completeness: 0, availableWeight: 0, totalWeight: 1 },
          market_timing: { available: false, completeness: 0, availableWeight: 0, totalWeight: 1 },
          stability: { available: true, completeness: 100, availableWeight: 1, totalWeight: 1 },
          growth_potential: { available: true, completeness: 100, availableWeight: 1, totalWeight: 1 },
          livability: { available: true, completeness: 100, availableWeight: 1, totalWeight: 1 },
        };

        const componentWeights = {
          affordability: 0.30,
          market_timing: 0.25,
          stability: 0.20,
          growth_potential: 0.15,
          livability: 0.10,
        };

        const result = service.checkScoreAvailability(componentAvailability, componentWeights);

        // Missing: 0.30 + 0.25 = 0.55 (55%)
        expect(result.available).toBe(false);
        expect(result.status).toBe('unavailable');
        expect(result.reason).toContain('Only');
        expect(result.reason).toContain('available');
        expect(result.missingComponents).toContain('affordability');
        expect(result.missingComponents).toContain('market_timing');
      });

      it('returns score when <=50% of weight is missing', () => {
        const componentAvailability = {
          affordability: { available: true, completeness: 100, availableWeight: 1, totalWeight: 1 },
          market_timing: { available: true, completeness: 100, availableWeight: 1, totalWeight: 1 },
          stability: { available: false, completeness: 0, availableWeight: 0, totalWeight: 1 },
          growth_potential: { available: false, completeness: 0, availableWeight: 0, totalWeight: 1 },
          livability: { available: true, completeness: 100, availableWeight: 1, totalWeight: 1 },
        };

        const componentWeights = {
          affordability: 0.30,
          market_timing: 0.25,
          stability: 0.20,
          growth_potential: 0.15,
          livability: 0.10,
        };

        const result = service.checkScoreAvailability(componentAvailability, componentWeights);

        // Available: 0.30 + 0.25 + 0.10 = 0.65 (65%)
        expect(result.available).toBe(true);
        expect(result.completeness).toBe(65);
      });

      it('includes reason when score is unavailable', () => {
        const componentAvailability = {
          cash_flow: { available: false, completeness: 0, availableWeight: 0, totalWeight: 1 },
          rent_demand: { available: false, completeness: 0, availableWeight: 0, totalWeight: 1 },
          appreciation: { available: false, completeness: 0, availableWeight: 0, totalWeight: 1 },
          entry_point: { available: true, completeness: 100, availableWeight: 1, totalWeight: 1 },
          risk: { available: true, completeness: 100, availableWeight: 1, totalWeight: 1 },
        };

        const componentWeights = {
          cash_flow: 0.35,
          rent_demand: 0.20,
          appreciation: 0.20,
          entry_point: 0.15,
          risk: 0.10,
        };

        const result = service.checkScoreAvailability(componentAvailability, componentWeights);

        // Missing: 0.35 + 0.20 + 0.20 = 0.75 (75%)
        expect(result.available).toBe(false);
        expect(result.reason).toBeDefined();
        expect(result.reason).toContain('minimum');
      });
    });

    describe('Score status determination', () => {
      it('returns status "complete" when all components available', () => {
        const componentAvailability = {
          demand_strength: { available: true, completeness: 100, availableWeight: 1, totalWeight: 1 },
          supply_balance: { available: true, completeness: 100, availableWeight: 1, totalWeight: 1 },
          price_stability: { available: true, completeness: 100, availableWeight: 1, totalWeight: 1 },
          economic_foundation: { available: true, completeness: 100, availableWeight: 1, totalWeight: 1 },
        };

        const componentWeights = {
          demand_strength: 0.35,
          supply_balance: 0.25,
          price_stability: 0.25,
          economic_foundation: 0.15,
        };

        const result = service.checkScoreAvailability(componentAvailability, componentWeights);

        expect(result.status).toBe('complete');
        expect(result.completeness).toBe(100);
        expect(result.missingComponents).toHaveLength(0);
      });

      it('returns status "partial" when some components missing but above threshold', () => {
        const componentAvailability = {
          demand_strength: { available: true, completeness: 100, availableWeight: 1, totalWeight: 1 },
          supply_balance: { available: true, completeness: 100, availableWeight: 1, totalWeight: 1 },
          price_stability: { available: true, completeness: 100, availableWeight: 1, totalWeight: 1 },
          economic_foundation: { available: false, completeness: 0, availableWeight: 0, totalWeight: 1 },
        };

        const componentWeights = {
          demand_strength: 0.35,
          supply_balance: 0.25,
          price_stability: 0.25,
          economic_foundation: 0.15,
        };

        const result = service.checkScoreAvailability(componentAvailability, componentWeights);

        // Available: 0.35 + 0.25 + 0.25 = 0.85 (85%)
        expect(result.available).toBe(true);
        expect(result.status).toBe('partial');
        expect(result.completeness).toBe(85);
        expect(result.missingComponents).toContain('economic_foundation');
      });

      it('tracks all missing components', () => {
        const componentAvailability = {
          affordability: { available: true, completeness: 100, availableWeight: 1, totalWeight: 1 },
          market_timing: { available: false, completeness: 0, availableWeight: 0, totalWeight: 1 },
          stability: { available: true, completeness: 100, availableWeight: 1, totalWeight: 1 },
          growth_potential: { available: false, completeness: 0, availableWeight: 0, totalWeight: 1 },
          livability: { available: true, completeness: 100, availableWeight: 1, totalWeight: 1 },
        };

        const componentWeights = {
          affordability: 0.30,
          market_timing: 0.25,
          stability: 0.20,
          growth_potential: 0.15,
          livability: 0.10,
        };

        const result = service.checkScoreAvailability(componentAvailability, componentWeights);

        expect(result.missingComponents).toContain('market_timing');
        expect(result.missingComponents).toContain('growth_potential');
        expect(result.missingComponents).toHaveLength(2);
      });
    });

    describe('Edge cases', () => {
      it('handles empty component availability', () => {
        const componentAvailability = {};
        const componentWeights = {};

        const result = service.checkScoreAvailability(componentAvailability, componentWeights);

        expect(result.completeness).toBe(0);
        expect(result.available).toBe(false);
      });

      it('handles mismatched component weights', () => {
        const componentAvailability = {
          affordability: { available: true, completeness: 100, availableWeight: 1, totalWeight: 1 },
          unknown_component: { available: true, completeness: 100, availableWeight: 1, totalWeight: 1 },
        };

        const componentWeights = {
          affordability: 0.30,
          // unknown_component has no weight defined
        };

        const result = service.checkScoreAvailability(componentAvailability, componentWeights);

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
          { name: 'hotness_score', weight: 0.3 }, // skip strategy when missing
        ];
        const availableMetrics = new Set(['metric_a', 'metric_b']);

        const result = service.redistributeWeights(metrics, availableMetrics);

        // Only metric_a and metric_b available (total 0.7)
        // New weights: 0.4/0.7 = 0.571, 0.3/0.7 = 0.429
        expect(result.get('metric_a')).toBeCloseTo(0.571, 2);
        expect(result.get('metric_b')).toBeCloseTo(0.429, 2);
        expect(result.has('hotness_score')).toBe(false);
      });

      it('proportionally increases remaining weights', () => {
        const metrics = [
          { name: 'metric_a', weight: 0.5 },
          { name: 'metric_b', weight: 0.3 },
          { name: 'hotness_score', weight: 0.2 }, // skip strategy
        ];
        const availableMetrics = new Set(['metric_a', 'metric_b']);

        const result = service.redistributeWeights(metrics, availableMetrics);

        // Ratio preserved: a/b = 0.5/0.3 = 1.667
        const redistributedRatio = result.get('metric_a')! / result.get('metric_b')!;
        expect(redistributedRatio).toBeCloseTo(0.5 / 0.3, 3);
      });

      it('remaining weights sum to 1.0', () => {
        const metrics = [
          { name: 'metric_a', weight: 0.4 },
          { name: 'metric_b', weight: 0.35 },
          { name: 'hotness_score', weight: 0.15 }, // skip
          { name: 'employment_yoy', weight: 0.1 }, // skip
        ];
        const availableMetrics = new Set(['metric_a', 'metric_b']);

        const result = service.redistributeWeights(metrics, availableMetrics);

        const sum = Array.from(result.values()).reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1.0, 10);
      });

      it('includes neutral strategy metrics with redistributed weight', () => {
        const metrics = [
          { name: 'metric_a', weight: 0.4 },
          { name: 'unemployment_rate', weight: 0.3 }, // neutral strategy (missing)
          { name: 'hotness_score', weight: 0.3 }, // skip strategy (missing)
        ];
        const availableMetrics = new Set(['metric_a']);

        const result = service.redistributeWeights(metrics, availableMetrics);

        // metric_a available, unemployment_rate neutral (included), hotness_score skipped
        // Total weight: 0.4 + 0.3 = 0.7
        expect(result.has('metric_a')).toBe(true);
        expect(result.has('unemployment_rate')).toBe(true);
        expect(result.has('hotness_score')).toBe(false);

        const sum = Array.from(result.values()).reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1.0, 10);
      });

      it('includes penalize strategy metrics with redistributed weight', () => {
        const metrics = [
          { name: 'metric_a', weight: 0.4 },
          { name: 'zhvi', weight: 0.3 }, // penalize strategy (missing)
          { name: 'hotness_score', weight: 0.3 }, // skip strategy (missing)
        ];
        const availableMetrics = new Set(['metric_a']);

        const result = service.redistributeWeights(metrics, availableMetrics);

        expect(result.has('metric_a')).toBe(true);
        expect(result.has('zhvi')).toBe(true);
        expect(result.has('hotness_score')).toBe(false);
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
          { name: 'hotness_score', weight: 0.5 },
          { name: 'employment_yoy', weight: 0.5 },
        ];
        const availableMetrics = new Set<string>();

        const result = service.redistributeWeights(metrics, availableMetrics);

        expect(result.size).toBe(0);
      });

      it('handles single metric available', () => {
        const metrics = [
          { name: 'metric_a', weight: 0.3 },
          { name: 'hotness_score', weight: 0.7 }, // skip
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
        'zhvi',           // penalize
        'zori',           // penalize
        'hotness_score',  // skip
        'unemployment_rate', // neutral
        'pending_ratio',  // neutral
      ];
      const availableMetrics = ['zhvi']; // Only zhvi available

      const result = service.getMissingMetricsSummary(allMetrics, availableMetrics);

      expect(result.missing).toContain('zori');
      expect(result.missing).toContain('hotness_score');
      expect(result.missing).toContain('unemployment_rate');
      expect(result.missing).toContain('pending_ratio');
      expect(result.missing).not.toContain('zhvi');

      expect(result.penalized).toContain('zori');
      expect(result.skipped).toContain('hotness_score');
      expect(result.neutral).toContain('unemployment_rate');
      expect(result.neutral).toContain('pending_ratio');
    });

    it('returns empty arrays when all metrics available', () => {
      const allMetrics = ['zhvi', 'zori', 'hotness_score'];
      const availableMetrics = ['zhvi', 'zori', 'hotness_score'];

      const result = service.getMissingMetricsSummary(allMetrics, availableMetrics);

      expect(result.missing).toHaveLength(0);
      expect(result.skipped).toHaveLength(0);
      expect(result.neutral).toHaveLength(0);
      expect(result.penalized).toHaveLength(0);
    });

    it('handles all metrics missing', () => {
      const allMetrics = [
        'zhvi',           // penalize
        'hotness_score',  // skip
        'unemployment_rate', // neutral
      ];
      const availableMetrics: string[] = [];

      const result = service.getMissingMetricsSummary(allMetrics, availableMetrics);

      expect(result.missing).toHaveLength(3);
      expect(result.penalized).toContain('zhvi');
      expect(result.skipped).toContain('hotness_score');
      expect(result.neutral).toContain('unemployment_rate');
    });
  });

  // ===========================================================================
  // Required Metrics Configuration Tests
  // ===========================================================================
  describe('Required Metrics Configuration', () => {
    it('affordability requires zhvi and zori', () => {
      expect(REQUIRED_METRICS_BY_COMPONENT.affordability).toContain('zhvi');
      expect(REQUIRED_METRICS_BY_COMPONENT.affordability).toContain('zori');
    });

    it('cash_flow requires zhvi and zori', () => {
      expect(REQUIRED_METRICS_BY_COMPONENT.cash_flow).toContain('zhvi');
      expect(REQUIRED_METRICS_BY_COMPONENT.cash_flow).toContain('zori');
    });

    it('rent_demand requires zori', () => {
      expect(REQUIRED_METRICS_BY_COMPONENT.rent_demand).toContain('zori');
    });

    it('appreciation requires zhvi', () => {
      expect(REQUIRED_METRICS_BY_COMPONENT.appreciation).toContain('zhvi');
    });

    it('Market Health components have no required metrics', () => {
      expect(REQUIRED_METRICS_BY_COMPONENT.demand_strength).toHaveLength(0);
      expect(REQUIRED_METRICS_BY_COMPONENT.supply_balance).toHaveLength(0);
      expect(REQUIRED_METRICS_BY_COMPONENT.price_stability).toHaveLength(0);
      expect(REQUIRED_METRICS_BY_COMPONENT.economic_foundation).toHaveLength(0);
    });

    it('some HomeReady components have no required metrics', () => {
      expect(REQUIRED_METRICS_BY_COMPONENT.market_timing).toHaveLength(0);
      expect(REQUIRED_METRICS_BY_COMPONENT.stability).toHaveLength(0);
      expect(REQUIRED_METRICS_BY_COMPONENT.growth_potential).toHaveLength(0);
      expect(REQUIRED_METRICS_BY_COMPONENT.livability).toHaveLength(0);
    });

    it('some InvestorEdge components have no required metrics', () => {
      expect(REQUIRED_METRICS_BY_COMPONENT.entry_point).toHaveLength(0);
      expect(REQUIRED_METRICS_BY_COMPONENT.risk).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Integration Tests with Fixture Data
  // ===========================================================================
  describe('Integration with fixture scenarios', () => {
    it('handles MISSING_OPTIONAL_001 scenario - walkability skip', () => {
      // Walkability is a skip strategy metric
      const result = service.handleMissingMetric('walkability_score');

      // Note: walkability_score is not in METRIC_MISSING_STRATEGIES
      // so it defaults to skip
      expect(result.strategy).toBe('skip');
      expect(result.includeInWeight).toBe(false);
    });

    it('handles MISSING_NEUTRAL_002 scenario - school_rating neutral', () => {
      // Note: school_rating is not in METRIC_MISSING_STRATEGIES
      // so it defaults to skip, not neutral
      const result = service.handleMissingMetric('school_rating');

      expect(result.strategy).toBe('skip');
    });

    it('handles MISSING_REQUIRED_003 scenario - median_home_price penalize', () => {
      // zhvi (home price) is penalize strategy
      const result = service.handleMissingMetric('zhvi');

      expect(result.strategy).toBe('penalize');
      expect(result.score).toBe(25);
      expect(result.includeInWeight).toBe(true);
    });

    it('handles MISSING_MAJORITY_005 scenario - >50% missing', () => {
      // When >50% of weight is missing, score should be unavailable
      const componentAvailability = {
        affordability: { available: true, completeness: 100, availableWeight: 1, totalWeight: 1 },
        market_timing: { available: false, completeness: 0, availableWeight: 0, totalWeight: 1 },
        stability: { available: false, completeness: 0, availableWeight: 0, totalWeight: 1 },
        growth_potential: { available: false, completeness: 0, availableWeight: 0, totalWeight: 1 },
        livability: { available: false, completeness: 0, availableWeight: 0, totalWeight: 1 },
      };

      const componentWeights = {
        affordability: 0.30,
        market_timing: 0.25,
        stability: 0.20,
        growth_potential: 0.15,
        livability: 0.10,
      };

      const result = service.checkScoreAvailability(componentAvailability, componentWeights);

      // Only 30% available
      expect(result.available).toBe(false);
      expect(result.status).toBe('unavailable');
      expect(result.completeness).toBe(30);
      expect(result.reason).toContain('30%'); // Only 30% of components available
    });
  });
});
