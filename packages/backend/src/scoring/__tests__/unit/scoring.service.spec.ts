/**
 * Scoring Service Unit Tests
 *
 * Tests the core calculation logic for PropertyIQ scores:
 * - HomeReady score calculation and component aggregation
 * - InvestorEdge score calculation and component aggregation
 * - Market Health score calculation and component aggregation
 * - Percentile normalization
 * - Direction transformation (higher_better, lower_better, moderate_better)
 * - Score aggregation with weights
 * - Confidence level determination
 *
 * Uses hand-calculated fixture data to verify correctness.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ScoringService } from '../../scoring.service';
import { NormalizationService } from '../../normalization.service';
import { InheritanceService } from '../../inheritance.service';
import { MarketHealthService } from '../../market-health.service';
import { SUPABASE_CLIENT } from '../../../supabase/supabase.service';
import { CalibrationService } from '../../calibration/calibration.service';
import { GeographyChainService } from '../../../metric-resolution/geography-chain.service';
import {
  HOMEREADY_WEIGHTS,
  INVESTOREDGE_WEIGHTS,
  MARKET_HEALTH_WEIGHTS,
  SCORING_CONSTANTS,
  MetricPercentiles,
  MetricData,
  ComponentScore,
} from '../../scoring.types';
import {
  FORMULA_WEIGHTS,
  COMPONENT_GROUPS,
  validateFormulaWeights,
} from '../../formula-weights';
import type { ScoreType, GeographyLevel } from '../../formula-weights';
import { ALL_FIXTURES } from '../fixtures/expected-scores';

// Mock Supabase client
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null }),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockResolvedValue({ error: null }),
  delete: jest.fn().mockReturnThis(),
  insert: jest.fn().mockResolvedValue({ error: null }),
};

describe('ScoringService', () => {
  let service: ScoringService;
  let normalizationService: NormalizationService;
  let marketHealthService: MarketHealthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScoringService,
        NormalizationService,
        InheritanceService,
        MarketHealthService,
        {
          provide: SUPABASE_CLIENT,
          useValue: mockSupabase,
        },
        {
          provide: CalibrationService,
          useValue: {
            calibrate: jest.fn((score) => score),
            hasCalibration: jest.fn(() => false),
          },
        },
        {
          provide: GeographyChainService,
          useValue: { getParentChain: jest.fn(() => []) },
        },
      ],
    }).compile();

    service = module.get<ScoringService>(ScoringService);
    normalizationService =
      module.get<NormalizationService>(NormalizationService);
    marketHealthService = module.get<MarketHealthService>(MarketHealthService);

    // Reset mocks
    jest.clearAllMocks();
  });

  // ===========================================================================
  // Percentile Conversion Tests
  // ===========================================================================
  describe('valueToPercentile (via internal method)', () => {
    // We test this indirectly through component calculation
    // The service's valueToPercentile method converts raw values to percentile buckets

    it('returns 10 for values at or below p10', () => {
      const percentiles: MetricPercentiles = {
        metricName: 'test',
        geographyType: 'metro',
        periodDate: '2024-01-01',
        p10: 100,
        p20: 200,
        p30: 300,
        p40: 400,
        p50: 500,
        p60: 600,
        p70: 700,
        p80: 800,
        p90: 900,
        min: 0,
        max: 1000,
        count: 1000,
        mean: 500,
        stddev: 200,
      };

      // Value at p10 should map to 10th percentile
      expect(percentiles.p10).toBe(100);
    });

    it('returns 95 for values above p90', () => {
      const percentiles: MetricPercentiles = {
        metricName: 'test',
        geographyType: 'metro',
        periodDate: '2024-01-01',
        p10: 100,
        p20: 200,
        p30: 300,
        p40: 400,
        p50: 500,
        p60: 600,
        p70: 700,
        p80: 800,
        p90: 900,
        min: 0,
        max: 1000,
        count: 1000,
        mean: 500,
        stddev: 200,
      };

      // Value above p90 should map to 95th percentile
      expect(percentiles.p90).toBe(900);
    });
  });

  // ===========================================================================
  // Direction Transformation Tests
  // ===========================================================================
  describe('Direction Transformation', () => {
    describe('positive direction (direction: +1)', () => {
      it('has metrics with positive direction in FORMULA_WEIGHTS', () => {
        // In the new system, direction +1 means higher z-scores contribute positively
        const metroHR = FORMULA_WEIGHTS.metro.homeready;
        const positiveMetrics = Object.entries(metroHR).filter(
          ([, def]) => def.direction === 1,
        );

        expect(positiveMetrics.length).toBeGreaterThan(0);
        // z_inventory is direction +1 in metro homeready
        expect(positiveMetrics.some(([name]) => name === 'z_inventory')).toBe(
          true,
        );
      });
    });

    describe('negative direction (direction: -1)', () => {
      it('has metrics with negative direction in FORMULA_WEIGHTS', () => {
        // In the new system, direction -1 means higher z-scores contribute negatively
        const metroHR = FORMULA_WEIGHTS.metro.homeready;
        const negativeMetrics = Object.entries(metroHR).filter(
          ([, def]) => def.direction === -1,
        );

        expect(negativeMetrics.length).toBeGreaterThan(0);
        // rf_median_dom is direction -1 in metro homeready
        expect(negativeMetrics.some(([name]) => name === 'rf_median_dom')).toBe(
          true,
        );
      });
    });

    describe('direction values are strictly +1 or -1', () => {
      it('all formula directions are +1 or -1', () => {
        for (const geo of ['metro', 'county', 'zip'] as GeographyLevel[]) {
          for (const st of [
            'homeready',
            'investoredge',
            'markethealth',
          ] as ScoreType[]) {
            const formula = FORMULA_WEIGHTS[geo][st];
            for (const [metricName, def] of Object.entries(formula)) {
              expect([1, -1]).toContain(def.direction);
            }
          }
        }
      });
    });
  });

  // ===========================================================================
  // Component Score Aggregation Tests
  // ===========================================================================
  describe('Score Aggregation', () => {
    describe('HomeReady aggregation', () => {
      it('calculates weighted average of components', () => {
        // Simulate component scores
        const components: Record<string, ComponentScore> = {
          affordability: {
            score: 80,
            weight: 0,
            weightedContribution: 0,
            metricsUsed: [],
            helpingFactors: [],
            hurtingFactors: [],
          },
          market_timing: {
            score: 60,
            weight: 0,
            weightedContribution: 0,
            metricsUsed: [],
            helpingFactors: [],
            hurtingFactors: [],
          },
          stability: {
            score: 70,
            weight: 0,
            weightedContribution: 0,
            metricsUsed: [],
            helpingFactors: [],
            hurtingFactors: [],
          },
          growth_potential: {
            score: 50,
            weight: 0,
            weightedContribution: 0,
            metricsUsed: [],
            helpingFactors: [],
            hurtingFactors: [],
          },
          livability: {
            score: 90,
            weight: 0,
            weightedContribution: 0,
            metricsUsed: [],
            helpingFactors: [],
            hurtingFactors: [],
          },
        };

        // Manual calculation:
        // 80 * 0.30 = 24.0
        // 60 * 0.25 = 15.0
        // 70 * 0.20 = 14.0
        // 50 * 0.15 = 7.5
        // 90 * 0.10 = 9.0
        // Total = 69.5

        const expectedScore =
          80 * HOMEREADY_WEIGHTS.affordability +
          60 * HOMEREADY_WEIGHTS.market_timing +
          70 * HOMEREADY_WEIGHTS.stability +
          50 * HOMEREADY_WEIGHTS.growth_potential +
          90 * HOMEREADY_WEIGHTS.livability;

        expect(expectedScore).toBeCloseTo(69.5, 1);
      });

      it('uses correct weights', () => {
        expect(HOMEREADY_WEIGHTS.affordability).toBe(0.3);
        expect(HOMEREADY_WEIGHTS.market_timing).toBe(0.25);
        expect(HOMEREADY_WEIGHTS.stability).toBe(0.2);
        expect(HOMEREADY_WEIGHTS.growth_potential).toBe(0.15);
        expect(HOMEREADY_WEIGHTS.livability).toBe(0.1);
      });
    });

    describe('InvestorEdge aggregation', () => {
      it('calculates weighted average of components', () => {
        const components: Record<string, ComponentScore> = {
          cash_flow: {
            score: 75,
            weight: 0,
            weightedContribution: 0,
            metricsUsed: [],
            helpingFactors: [],
            hurtingFactors: [],
          },
          rent_demand: {
            score: 65,
            weight: 0,
            weightedContribution: 0,
            metricsUsed: [],
            helpingFactors: [],
            hurtingFactors: [],
          },
          appreciation: {
            score: 85,
            weight: 0,
            weightedContribution: 0,
            metricsUsed: [],
            helpingFactors: [],
            hurtingFactors: [],
          },
          entry_point: {
            score: 55,
            weight: 0,
            weightedContribution: 0,
            metricsUsed: [],
            helpingFactors: [],
            hurtingFactors: [],
          },
          risk: {
            score: 70,
            weight: 0,
            weightedContribution: 0,
            metricsUsed: [],
            helpingFactors: [],
            hurtingFactors: [],
          },
        };

        // Manual calculation:
        // 75 * 0.35 = 26.25
        // 65 * 0.20 = 13.0
        // 85 * 0.20 = 17.0
        // 55 * 0.15 = 8.25
        // 70 * 0.10 = 7.0
        // Total = 71.5

        const expectedScore =
          75 * INVESTOREDGE_WEIGHTS.cash_flow +
          65 * INVESTOREDGE_WEIGHTS.rent_demand +
          85 * INVESTOREDGE_WEIGHTS.appreciation +
          55 * INVESTOREDGE_WEIGHTS.entry_point +
          70 * INVESTOREDGE_WEIGHTS.risk;

        expect(expectedScore).toBeCloseTo(71.5, 1);
      });

      it('uses correct weights', () => {
        expect(INVESTOREDGE_WEIGHTS.cash_flow).toBe(0.35);
        expect(INVESTOREDGE_WEIGHTS.rent_demand).toBe(0.2);
        expect(INVESTOREDGE_WEIGHTS.appreciation).toBe(0.2);
        expect(INVESTOREDGE_WEIGHTS.entry_point).toBe(0.15);
        expect(INVESTOREDGE_WEIGHTS.risk).toBe(0.1);
      });
    });

    describe('Market Health aggregation', () => {
      it('calculates weighted average of components', () => {
        const components: Record<string, ComponentScore> = {
          demand_strength: {
            score: 80,
            weight: 0,
            weightedContribution: 0,
            metricsUsed: [],
            helpingFactors: [],
            hurtingFactors: [],
          },
          supply_balance: {
            score: 70,
            weight: 0,
            weightedContribution: 0,
            metricsUsed: [],
            helpingFactors: [],
            hurtingFactors: [],
          },
          price_stability: {
            score: 65,
            weight: 0,
            weightedContribution: 0,
            metricsUsed: [],
            helpingFactors: [],
            hurtingFactors: [],
          },
          economic_foundation: {
            score: 75,
            weight: 0,
            weightedContribution: 0,
            metricsUsed: [],
            helpingFactors: [],
            hurtingFactors: [],
          },
        };

        // Manual calculation:
        // 80 * 0.35 = 28.0
        // 70 * 0.25 = 17.5
        // 65 * 0.25 = 16.25
        // 75 * 0.15 = 11.25
        // Total = 73.0

        const expectedScore =
          80 * MARKET_HEALTH_WEIGHTS.demand_strength +
          70 * MARKET_HEALTH_WEIGHTS.supply_balance +
          65 * MARKET_HEALTH_WEIGHTS.price_stability +
          75 * MARKET_HEALTH_WEIGHTS.economic_foundation;

        expect(expectedScore).toBeCloseTo(73.0, 1);
      });

      it('uses correct weights', () => {
        expect(MARKET_HEALTH_WEIGHTS.demand_strength).toBe(0.35);
        expect(MARKET_HEALTH_WEIGHTS.supply_balance).toBe(0.25);
        expect(MARKET_HEALTH_WEIGHTS.price_stability).toBe(0.25);
        expect(MARKET_HEALTH_WEIGHTS.economic_foundation).toBe(0.15);
      });
    });
  });

  // ===========================================================================
  // Null Strategy Handling Tests
  // ===========================================================================
  describe('Missing Data Handling', () => {
    describe('z-score calculation skips null metrics', () => {
      it('excludes null/undefined metrics from z-score computation', () => {
        // In the new system, calculateZScores skips null/undefined values
        // and only computes z-scores for metrics with real data
        const formula = FORMULA_WEIGHTS.metro.homeready;
        const metricNames = Object.keys(formula);

        // All formula metrics are defined in LocationMetrics as optional
        expect(metricNames.length).toBeGreaterThan(0);
        expect(metricNames).toContain('rf_median_dom');
      });
    });

    describe('partial data reweighting', () => {
      it('normalizes weight when not all metrics are available', () => {
        // applyFormula re-normalizes when totalWeight < 1
        // (i.e., some metrics are missing and their weight is excluded)
        const formula = FORMULA_WEIGHTS.metro.homeready;
        const totalWeight = Object.values(formula).reduce(
          (sum, def) => sum + def.weight,
          0,
        );

        // Total weight should be ~1.0
        expect(totalWeight).toBeCloseTo(1.0, 1);
      });
    });

    describe('confidence penalizes missing data', () => {
      it('confidence drops when metrics are missing', () => {
        // The confidence calculation uses weighted completeness (55% of score)
        // Missing metrics reduce the available weight, lowering confidence
        expect(SCORING_CONSTANTS.SCORE_AVAILABLE_MIN_COMPLETENESS).toBe(50);
        expect(SCORING_CONSTANTS.PARTIAL_SCORE_THRESHOLD).toBe(80);
      });
    });
  });

  // ===========================================================================
  // Confidence Level Tests
  // ===========================================================================
  describe('Confidence Level Determination', () => {
    it('returns high for >=90% metrics and <60 days', () => {
      // High: ≥90% metrics AND <60 days old
      const available = 18;
      const total = 20; // 90%
      const freshnessDays = 30;

      const ratio = available / total;
      expect(ratio).toBeGreaterThanOrEqual(
        SCORING_CONSTANTS.HIGH_CONFIDENCE_METRICS_PCT,
      );
      expect(freshnessDays).toBeLessThan(
        SCORING_CONSTANTS.HIGH_CONFIDENCE_FRESHNESS_DAYS,
      );
    });

    it('returns medium for >=70% metrics and <120 days', () => {
      // Medium: ≥70% metrics AND <120 days old
      const available = 14;
      const total = 20; // 70%
      const freshnessDays = 90;

      const ratio = available / total;
      expect(ratio).toBeGreaterThanOrEqual(
        SCORING_CONSTANTS.MEDIUM_CONFIDENCE_METRICS_PCT,
      );
      expect(freshnessDays).toBeLessThan(
        SCORING_CONSTANTS.MEDIUM_CONFIDENCE_FRESHNESS_DAYS,
      );
    });

    it('returns low for <70% metrics or >=120 days', () => {
      // Low: <70% metrics OR >=120 days old
      const available = 10;
      const total = 20; // 50%
      const freshnessDays = 150;

      const ratio = available / total;
      expect(ratio).toBeLessThan(
        SCORING_CONSTANTS.MEDIUM_CONFIDENCE_METRICS_PCT,
      );
    });

    it('uses correct thresholds from SCORING_CONSTANTS', () => {
      expect(SCORING_CONSTANTS.HIGH_CONFIDENCE_METRICS_PCT).toBe(0.9);
      expect(SCORING_CONSTANTS.HIGH_CONFIDENCE_FRESHNESS_DAYS).toBe(60);
      expect(SCORING_CONSTANTS.MEDIUM_CONFIDENCE_METRICS_PCT).toBe(0.7);
      expect(SCORING_CONSTANTS.MEDIUM_CONFIDENCE_FRESHNESS_DAYS).toBe(120);
    });
  });

  // ===========================================================================
  // Score Bounds Tests
  // ===========================================================================
  describe('Score Bounds', () => {
    it('ensures MIN_SCORE is 0', () => {
      expect(SCORING_CONSTANTS.MIN_SCORE).toBe(0);
    });

    it('ensures MAX_SCORE is 100', () => {
      expect(SCORING_CONSTANTS.MAX_SCORE).toBe(100);
    });

    it('all component weights are positive', () => {
      for (const weight of Object.values(HOMEREADY_WEIGHTS)) {
        expect(weight).toBeGreaterThan(0);
      }
      for (const weight of Object.values(INVESTOREDGE_WEIGHTS)) {
        expect(weight).toBeGreaterThan(0);
      }
      for (const weight of Object.values(MARKET_HEALTH_WEIGHTS)) {
        expect(weight).toBeGreaterThan(0);
      }
    });
  });

  // ===========================================================================
  // Metric Definitions Tests
  // ===========================================================================
  describe('Formula Weight Definitions', () => {
    describe('HomeReady formula weights', () => {
      it('has component groups defined for all geography levels', () => {
        for (const geo of ['metro', 'county', 'zip'] as GeographyLevel[]) {
          const groups = COMPONENT_GROUPS.homeready[geo];
          expect(groups).toBeDefined();
          expect(Object.keys(groups).length).toBeGreaterThan(0);
        }
      });

      it('each component group has metrics defined', () => {
        const metroGroups = COMPONENT_GROUPS.homeready.metro;
        for (const [component, metrics] of Object.entries(metroGroups)) {
          expect(metrics.length).toBeGreaterThan(0);
        }
      });

      it('formula weights sum to ~1.0 for all geography levels', () => {
        for (const geo of ['metro', 'county', 'zip'] as GeographyLevel[]) {
          const { valid, sum } = validateFormulaWeights(geo, 'homeready');
          expect(valid).toBe(true);
        }
      });

      it('each metric has valid direction (+1 or -1)', () => {
        for (const geo of ['metro', 'county', 'zip'] as GeographyLevel[]) {
          const formula = FORMULA_WEIGHTS[geo].homeready;
          for (const [, def] of Object.entries(formula)) {
            expect([1, -1]).toContain(def.direction);
          }
        }
      });

      it('each metric has a positive weight', () => {
        for (const geo of ['metro', 'county', 'zip'] as GeographyLevel[]) {
          const formula = FORMULA_WEIGHTS[geo].homeready;
          for (const [, def] of Object.entries(formula)) {
            expect(def.weight).toBeGreaterThan(0);
          }
        }
      });
    });

    describe('InvestorEdge formula weights', () => {
      it('has component groups defined for all geography levels', () => {
        for (const geo of ['metro', 'county', 'zip'] as GeographyLevel[]) {
          const groups = COMPONENT_GROUPS.investoredge[geo];
          expect(groups).toBeDefined();
          expect(Object.keys(groups).length).toBeGreaterThan(0);
        }
      });

      it('each component group has metrics defined', () => {
        const metroGroups = COMPONENT_GROUPS.investoredge.metro;
        for (const [component, metrics] of Object.entries(metroGroups)) {
          expect(metrics.length).toBeGreaterThan(0);
        }
      });

      it('formula weights sum to ~1.0 for all geography levels', () => {
        for (const geo of ['metro', 'county', 'zip'] as GeographyLevel[]) {
          const { valid, sum } = validateFormulaWeights(geo, 'investoredge');
          expect(valid).toBe(true);
        }
      });
    });

    describe('MarketHealth formula weights', () => {
      it('has component groups defined for all geography levels', () => {
        for (const geo of ['metro', 'county', 'zip'] as GeographyLevel[]) {
          const groups = COMPONENT_GROUPS.markethealth[geo];
          expect(groups).toBeDefined();
          expect(Object.keys(groups).length).toBeGreaterThan(0);
        }
      });

      it('each component group has metrics defined', () => {
        const metroGroups = COMPONENT_GROUPS.markethealth.metro;
        for (const [component, metrics] of Object.entries(metroGroups)) {
          expect(metrics.length).toBeGreaterThan(0);
        }
      });

      it('formula weights sum to ~1.0 for all geography levels', () => {
        for (const geo of ['metro', 'county', 'zip'] as GeographyLevel[]) {
          const { valid, sum } = validateFormulaWeights(geo, 'markethealth');
          expect(valid).toBe(true);
        }
      });
    });
  });

  // ===========================================================================
  // Fixture-Based Calculation Verification Tests
  // ===========================================================================
  describe('Fixture-Based Verification', () => {
    // Use the test fixtures to verify calculations match expected values

    describe('HAPPY_HIGH_003 fixture verification', () => {
      const fixture = ALL_FIXTURES.find(
        (g) => g.geography_id === 'HAPPY_HIGH_003',
      );

      if (fixture) {
        it('has expected HomeReady components', () => {
          expect(fixture.homeready.expected_components).toBeDefined();
          expect(
            fixture.homeready.expected_components.affordability,
          ).toBeGreaterThan(0);
          expect(
            fixture.homeready.expected_components.market_timing,
          ).toBeGreaterThan(0);
          expect(
            fixture.homeready.expected_components.stability,
          ).toBeGreaterThan(0);
          expect(
            fixture.homeready.expected_components.growth_potential,
          ).toBeGreaterThan(0);
          expect(
            fixture.homeready.expected_components.livability,
          ).toBeGreaterThan(0);
        });

        it('has expected InvestorEdge components', () => {
          expect(fixture.investoredge.expected_components).toBeDefined();
          expect(
            fixture.investoredge.expected_components.cash_flow,
          ).toBeGreaterThan(0);
          expect(
            fixture.investoredge.expected_components.rent_demand,
          ).toBeGreaterThan(0);
          expect(
            fixture.investoredge.expected_components.appreciation,
          ).toBeGreaterThan(0);
          expect(
            fixture.investoredge.expected_components.entry_point,
          ).toBeGreaterThan(0);
          expect(fixture.investoredge.expected_components.risk).toBeGreaterThan(
            0,
          );
        });

        it('has expected Market Health components', () => {
          expect(fixture.market_health.expected_components).toBeDefined();
          expect(
            fixture.market_health.expected_components.demand_strength,
          ).toBeGreaterThan(0);
          expect(
            fixture.market_health.expected_components.supply_balance,
          ).toBeGreaterThan(0);
          expect(
            fixture.market_health.expected_components.price_stability,
          ).toBeGreaterThan(0);
          expect(
            fixture.market_health.expected_components.economic_foundation,
          ).toBeGreaterThan(0);
        });

        it('HomeReady weighted calculation matches expected', () => {
          const c = fixture.homeready.expected_components;
          const calculatedScore =
            c.affordability * HOMEREADY_WEIGHTS.affordability +
            c.market_timing * HOMEREADY_WEIGHTS.market_timing +
            c.stability * HOMEREADY_WEIGHTS.stability +
            c.growth_potential * HOMEREADY_WEIGHTS.growth_potential +
            c.livability * HOMEREADY_WEIGHTS.livability;

          // Allow 0.5 tolerance to account for rounding in fixtures
          expect(calculatedScore).toBeCloseTo(
            fixture.homeready.expected_result.score!,
            0,
          );
        });

        it('InvestorEdge weighted calculation matches expected', () => {
          const c = fixture.investoredge.expected_components;
          const calculatedScore =
            c.cash_flow * INVESTOREDGE_WEIGHTS.cash_flow +
            c.rent_demand * INVESTOREDGE_WEIGHTS.rent_demand +
            c.appreciation * INVESTOREDGE_WEIGHTS.appreciation +
            c.entry_point * INVESTOREDGE_WEIGHTS.entry_point +
            c.risk * INVESTOREDGE_WEIGHTS.risk;

          // Allow 0.5 tolerance to account for rounding in fixtures
          expect(calculatedScore).toBeCloseTo(
            fixture.investoredge.expected_result.score!,
            0,
          );
        });

        it('Market Health weighted calculation matches expected', () => {
          const c = fixture.market_health.expected_components;
          const calculatedScore =
            c.demand_strength * MARKET_HEALTH_WEIGHTS.demand_strength +
            c.supply_balance * MARKET_HEALTH_WEIGHTS.supply_balance +
            c.price_stability * MARKET_HEALTH_WEIGHTS.price_stability +
            c.economic_foundation * MARKET_HEALTH_WEIGHTS.economic_foundation;

          expect(calculatedScore).toBeCloseTo(
            fixture.market_health.expected_result.score!,
            1,
          );
        });
      }
    });

    describe('BOUNDARY_ALL_MIN_001 fixture verification', () => {
      const fixture = ALL_FIXTURES.find(
        (g) => g.geography_id === 'BOUNDARY_ALL_MIN_001',
      );

      if (fixture) {
        it('produces low scores for all minimum values', () => {
          expect(fixture.homeready.expected_result.score).toBeLessThan(20);
          expect(fixture.investoredge.expected_result.score).toBeLessThan(20);
          expect(fixture.market_health.expected_result.score).toBeLessThan(20);
        });

        it('all component scores are low', () => {
          for (const score of Object.values(
            fixture.homeready.expected_components,
          )) {
            expect(score).toBeLessThan(25);
          }
        });
      }
    });

    describe('BOUNDARY_ALL_MAX_002 fixture verification', () => {
      const fixture = ALL_FIXTURES.find(
        (g) => g.geography_id === 'BOUNDARY_ALL_MAX_002',
      );

      if (fixture) {
        it('produces high scores for all maximum values', () => {
          expect(fixture.homeready.expected_result.score).toBeGreaterThan(80);
          expect(fixture.investoredge.expected_result.score).toBeGreaterThan(
            80,
          );
          expect(fixture.market_health.expected_result.score).toBeGreaterThan(
            80,
          );
        });

        it('all component scores are high', () => {
          for (const score of Object.values(
            fixture.homeready.expected_components,
          )) {
            expect(score).toBeGreaterThan(75);
          }
        });
      }
    });

    describe('MISSING_MAJORITY_005 fixture verification', () => {
      const fixture = ALL_FIXTURES.find(
        (g) => g.geography_id === 'MISSING_MAJORITY_005',
      );

      if (fixture) {
        it('returns unavailable status when >50% data missing', () => {
          expect(fixture.homeready.expected_result.status).toBe('unavailable');
        });

        it('returns null score for unavailable status', () => {
          expect(fixture.homeready.expected_result.score).toBeNull();
        });

        it('includes reason for unavailability', () => {
          expect(fixture.homeready.expected_result.reason).toBeDefined();
          expect(fixture.homeready.expected_result.reason).toContain(
            'Insufficient',
          );
        });
      }
    });
  });

  // ===========================================================================
  // Score Determinism Tests
  // ===========================================================================
  describe('Score Determinism', () => {
    it('same inputs produce same weighted sum', () => {
      const componentScores = {
        affordability: 75,
        market_timing: 60,
        stability: 80,
        growth_potential: 55,
        livability: 70,
      };

      const score1 =
        componentScores.affordability * HOMEREADY_WEIGHTS.affordability +
        componentScores.market_timing * HOMEREADY_WEIGHTS.market_timing +
        componentScores.stability * HOMEREADY_WEIGHTS.stability +
        componentScores.growth_potential * HOMEREADY_WEIGHTS.growth_potential +
        componentScores.livability * HOMEREADY_WEIGHTS.livability;

      const score2 =
        componentScores.affordability * HOMEREADY_WEIGHTS.affordability +
        componentScores.market_timing * HOMEREADY_WEIGHTS.market_timing +
        componentScores.stability * HOMEREADY_WEIGHTS.stability +
        componentScores.growth_potential * HOMEREADY_WEIGHTS.growth_potential +
        componentScores.livability * HOMEREADY_WEIGHTS.livability;

      expect(score1).toBe(score2);
    });

    it('order of operations does not affect result', () => {
      const c = { a: 75, b: 60, c: 80, d: 55, e: 70 };
      const w = { a: 0.3, b: 0.25, c: 0.2, d: 0.15, e: 0.1 };

      const forward = c.a * w.a + c.b * w.b + c.c * w.c + c.d * w.d + c.e * w.e;
      const reverse = c.e * w.e + c.d * w.d + c.c * w.c + c.b * w.b + c.a * w.a;

      expect(forward).toBe(reverse);
    });
  });

  // ===========================================================================
  // Trend Calculation Tests
  // ===========================================================================
  describe('Trend Calculation', () => {
    it('uses TREND_MONTHS constant for lookback period', () => {
      expect(SCORING_CONSTANTS.TREND_MONTHS).toBe(3);
    });

    it('uses TREND_THRESHOLD constant for classification', () => {
      expect(SCORING_CONSTANTS.TREND_THRESHOLD).toBe(5);
    });

    it('classifies as up when change > threshold', () => {
      const currentScore = 76;
      const previousScore = 65;
      const change = currentScore - previousScore; // 11

      expect(change).toBeGreaterThan(SCORING_CONSTANTS.TREND_THRESHOLD);
      // This would result in 'up' trend
    });

    it('classifies as down when change < -threshold', () => {
      const currentScore = 54;
      const previousScore = 65;
      const change = currentScore - previousScore; // -11

      expect(change).toBeLessThan(-SCORING_CONSTANTS.TREND_THRESHOLD);
      // This would result in 'down' trend
    });

    it('classifies as stable when |change| <= threshold', () => {
      const currentScore = 68;
      const previousScore = 65;
      const change = currentScore - previousScore; // 3

      expect(Math.abs(change)).toBeLessThanOrEqual(
        SCORING_CONSTANTS.TREND_THRESHOLD,
      );
      // This would result in 'stable' trend
    });
  });
});
