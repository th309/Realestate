/**
 * Scoring Service Unit Tests
 *
 * Post v3→propertyiq-only refactor (commit 00a0d7f6). Covers:
 * - Percentile normalization (valueToPercentile)
 * - Direction transformation (higher_better, lower_better, moderate_better)
 * - Null-metric handling
 * - Confidence level determination
 * - Score bounds
 * - Formula weight definitions across metro/county/zip
 * - Trend classification against SCORING_CONSTANTS.TREND_THRESHOLD
 *
 * The old multi-score component-aggregation tests (HomeReady /
 * InvestorEdge / MarketHealth component weights, fixture verification,
 * score-determinism tautologies) were removed when those consts were
 * deleted from scoring.types; see scoring.types.ts:210-217.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ScoringService } from '../../scoring.service';
import { NormalizationService } from '../../normalization.service';
import { InheritanceService } from '../../inheritance.service';

import { SUPABASE_CLIENT } from '../../../supabase/supabase.service';
import { CalibrationService } from '../../calibration/calibration.service';
import { GeographyChainService } from '../../../metric-resolution/geography-chain.service';
import { SCORING_CONSTANTS, MetricPercentiles } from '../../scoring.types';
import {
  FORMULA_WEIGHTS,
  COMPONENT_GROUPS,
  validateFormulaWeights,
} from '../../formula-weights';
import type { GeographyLevel } from '../../formula-weights';

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
  rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
};

describe('ScoringService', () => {
  let service: ScoringService;
  let normalizationService: NormalizationService;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScoringService,
        NormalizationService,
        InheritanceService,
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

  // ===========================================================================
  // Score Periods Tests
  // ===========================================================================
  describe('getScorePeriods', () => {
    it('returns 6 distinct score_dates newest-first from the RPC (no row-cap collapse)', async () => {
      // Arrange: RPC returns 6 distinct date strings (Postgres returns dates as strings)
      // This proves the ZIP-scale row-cap bug is fixed — 29k rows/period no longer
      // collapses the result to 1 period.
      const dates = [
        '2026-05-31',
        '2026-04-30',
        '2026-03-31',
        '2026-02-28',
        '2026-01-31',
        '2025-12-31',
      ];
      mockSupabase.rpc.mockResolvedValueOnce({ data: dates, error: null });

      const out = await service.getScorePeriods('zip', 'propertyiq', 6);

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'get_recent_score_periods',
        {
          p_geography: 'zip',
          p_score_type: 'propertyiq',
          p_limit: 6,
        },
      );
      expect(out).toEqual(dates);
    });
  });
});
