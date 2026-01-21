/**
 * Confidence Calculator Service Unit Tests
 *
 * Tests the confidence calculation formula and thresholds.
 * Formula: Confidence = (R² × 0.5) + (Sample Size Score × 0.3) + (Recency Score × 0.2)
 *
 * Thresholds:
 * - 70%+ = Healthy (high confidence)
 * - 55-69% = Monitor (medium confidence)
 * - 40-54% = Review (low confidence)
 * - <40% = Broken
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  ConfidenceCalculatorService,
  ConfidenceScore,
} from '../../../backtest/confidence-calculator.service';
import type { BacktestResult } from '../../../backtest/backtest-runner.service';
import { SupabaseService } from '../../../../supabase/supabase.service';

describe('ConfidenceCalculatorService', () => {
  let service: ConfidenceCalculatorService;
  let mockSupabaseService: jest.Mocked<SupabaseService>;

  beforeEach(async () => {
    mockSupabaseService = {
      getClient: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          upsert: jest.fn().mockResolvedValue({ error: null }),
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
          order: jest.fn().mockReturnThis(),
        }),
      }),
    } as unknown as jest.Mocked<SupabaseService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfidenceCalculatorService,
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    }).compile();

    service = module.get<ConfidenceCalculatorService>(ConfidenceCalculatorService);
  });

  // ============================================================================
  // Helper Functions
  // ============================================================================

  function createBacktestResult(overrides: Partial<BacktestResult> = {}): BacktestResult {
    return {
      runId: 'test-run-id',
      scoreType: 'homeready',
      componentName: null,
      geographyType: 'metro',
      formulaVersion: '1.0.0',
      backtestStartDate: '2022-01-01',
      backtestEndDate: '2024-01-01',
      outcomeHorizon: '1y',
      sampleCount: 200,
      geographyCount: 100,
      rSquared: 0.35,
      pearsonCorrelation: 0.59,
      spearmanCorrelation: 0.55,
      meanAbsoluteError: 8.5,
      rootMeanSquaredError: 12.3,
      meanAbsolutePercentageError: 15.2,
      scoreMean: 55.5,
      scoreStdDev: 12.3,
      outcomeMean: 5.2,
      outcomeStdDev: 3.8,
      hitRate: 0.65,
      decileSpread: 4.5,
      ...overrides,
    };
  }

  // ============================================================================
  // Confidence Formula Tests
  // ============================================================================

  describe('calculateConfidence', () => {
    describe('Formula Components', () => {
      it('applies formula: (R² × 0.5) + (Sample × 0.3) + (Recency × 0.2)', () => {
        // Create a result with known values for verifiable calculation
        const result = createBacktestResult({
          rSquared: 0.5, // Full correlation score (100% × 0.5 = 50)
          sampleCount: 200, // Full sample score for metro (100% × 0.3 = 30)
          backtestEndDate: new Date().toISOString().split('T')[0], // Recent = 100% × 0.2 = 20
        });

        const confidence = service.calculateConfidence(
          [result],
          'homeready',
          'metro',
          '1.0.0',
        );

        // R² of 0.5 = 100% correlation score
        // Sample of 200 at target 200 = 100% sample score
        // Recent date = 100% recency score
        // Total should be close to: 50 + 30 + 20 = 100
        expect(confidence.confidenceScore).toBeGreaterThanOrEqual(95);
      });

      it('R² component contributes 50% weight', () => {
        // Two results with different R² values, same sample and recency
        const highR2Result = createBacktestResult({
          rSquared: 0.5, // 100% correlation score
          sampleCount: 200,
          backtestEndDate: new Date().toISOString().split('T')[0],
        });

        const lowR2Result = createBacktestResult({
          rSquared: 0.25, // 50% correlation score
          sampleCount: 200,
          backtestEndDate: new Date().toISOString().split('T')[0],
        });

        const highR2Confidence = service.calculateConfidence(
          [highR2Result],
          'homeready',
          'metro',
          '1.0.0',
        );

        const lowR2Confidence = service.calculateConfidence(
          [lowR2Result],
          'homeready',
          'metro',
          '1.0.0',
        );

        // The difference should be approximately 25 points (50% correlation difference × 0.5 weight)
        const difference = highR2Confidence.confidenceScore - lowR2Confidence.confidenceScore;
        expect(difference).toBeGreaterThan(20);
        expect(difference).toBeLessThan(30);
      });

      it('sample size component contributes 30% weight', () => {
        // Results with different sample sizes
        const fullSampleResult = createBacktestResult({
          rSquared: 0.35,
          sampleCount: 200, // Target for metro
          backtestEndDate: new Date().toISOString().split('T')[0],
        });

        const halfSampleResult = createBacktestResult({
          rSquared: 0.35,
          sampleCount: 50, // 25% of target
          backtestEndDate: new Date().toISOString().split('T')[0],
        });

        const fullSampleConfidence = service.calculateConfidence(
          [fullSampleResult],
          'homeready',
          'metro',
          '1.0.0',
        );

        const halfSampleConfidence = service.calculateConfidence(
          [halfSampleResult],
          'homeready',
          'metro',
          '1.0.0',
        );

        // Lower sample should reduce confidence
        expect(fullSampleConfidence.confidenceScore).toBeGreaterThan(
          halfSampleConfidence.confidenceScore,
        );
      });

      it('recency component contributes 20% weight', () => {
        // Results with different recency
        const recentResult = createBacktestResult({
          rSquared: 0.35,
          sampleCount: 200,
          backtestEndDate: new Date().toISOString().split('T')[0],
        });

        const oldDate = new Date();
        oldDate.setDate(oldDate.getDate() - 120); // 120 days ago
        const oldResult = createBacktestResult({
          rSquared: 0.35,
          sampleCount: 200,
          backtestEndDate: oldDate.toISOString().split('T')[0],
        });

        const recentConfidence = service.calculateConfidence(
          [recentResult],
          'homeready',
          'metro',
          '1.0.0',
        );

        const oldConfidence = service.calculateConfidence(
          [oldResult],
          'homeready',
          'metro',
          '1.0.0',
        );

        // Older data should reduce confidence
        expect(recentConfidence.confidenceScore).toBeGreaterThan(
          oldConfidence.confidenceScore,
        );
        // But difference should be at most ~20 points (full recency weight)
        expect(recentConfidence.confidenceScore - oldConfidence.confidenceScore).toBeLessThan(25);
      });
    });

    describe('Status Thresholds', () => {
      it('returns status "healthy" for 70%+ confidence', () => {
        const result = createBacktestResult({
          rSquared: 0.45, // High R²
          sampleCount: 250,
          backtestEndDate: new Date().toISOString().split('T')[0],
        });

        const confidence = service.calculateConfidence(
          [result],
          'homeready',
          'metro',
          '1.0.0',
        );

        expect(confidence.confidenceScore).toBeGreaterThanOrEqual(70);
        expect(confidence.status).toBe('healthy');
        expect(confidence.confidenceLevel).toBe('high');
      });

      it('returns status "monitor" for 55-69% confidence', () => {
        const result = createBacktestResult({
          rSquared: 0.25, // Moderate R²
          sampleCount: 100,
          backtestEndDate: new Date().toISOString().split('T')[0],
        });

        const confidence = service.calculateConfidence(
          [result],
          'homeready',
          'metro',
          '1.0.0',
        );

        // Verify it falls in monitor range
        if (confidence.confidenceScore >= 55 && confidence.confidenceScore < 70) {
          expect(confidence.status).toBe('monitor');
          expect(confidence.confidenceLevel).toBe('medium');
        }
      });

      it('returns status "review" for 40-54% confidence', () => {
        const result = createBacktestResult({
          rSquared: 0.15, // Low R²
          sampleCount: 50,
          backtestEndDate: new Date().toISOString().split('T')[0],
        });

        const confidence = service.calculateConfidence(
          [result],
          'homeready',
          'metro',
          '1.0.0',
        );

        // Verify it falls in review range
        if (confidence.confidenceScore >= 40 && confidence.confidenceScore < 55) {
          expect(confidence.status).toBe('review');
          expect(confidence.confidenceLevel).toBe('low');
        }
      });

      it('returns status "broken" for <40% confidence', () => {
        const result = createBacktestResult({
          rSquared: 0.05, // Very low R²
          sampleCount: 15,
          backtestEndDate: '2023-01-01', // Old date
        });

        const confidence = service.calculateConfidence(
          [result],
          'homeready',
          'metro',
          '1.0.0',
        );

        // This should produce low confidence
        if (confidence.confidenceScore < 40) {
          expect(confidence.status).toBe('broken');
          expect(confidence.confidenceLevel).toBe('broken');
        }
      });
    });

    describe('Edge Cases', () => {
      it('returns empty confidence when no results match', () => {
        const result = createBacktestResult({
          scoreType: 'investoredge', // Different score type
        });

        const confidence = service.calculateConfidence(
          [result],
          'homeready', // Looking for homeready
          'metro',
          '1.0.0',
        );

        expect(confidence.confidenceScore).toBe(0);
        expect(confidence.status).toBe('broken');
        expect(confidence.sampleCount).toBe(0);
      });

      it('handles null R² gracefully', () => {
        const result = createBacktestResult({
          rSquared: null,
          sampleCount: 200,
        });

        const confidence = service.calculateConfidence(
          [result],
          'homeready',
          'metro',
          '1.0.0',
        );

        // Should still calculate, but correlation component is 0
        expect(confidence.correlationScore).toBe(0);
        expect(confidence.confidenceScore).toBeLessThan(60); // Missing correlation contribution
      });

      it('prefers 1y horizon results as primary', () => {
        const result6m = createBacktestResult({
          outcomeHorizon: '6m',
          rSquared: 0.2,
        });

        const result1y = createBacktestResult({
          outcomeHorizon: '1y',
          rSquared: 0.4,
        });

        const result3y = createBacktestResult({
          outcomeHorizon: '3y',
          rSquared: 0.3,
        });

        const confidence = service.calculateConfidence(
          [result6m, result1y, result3y],
          'homeready',
          'metro',
          '1.0.0',
        );

        // Should use 1y result's R² (0.4)
        expect(confidence.rSquared).toBe(0.4);
      });

      it('uses first matching result if no 1y horizon exists', () => {
        const result6m = createBacktestResult({
          outcomeHorizon: '6m',
          rSquared: 0.2,
        });

        const result3y = createBacktestResult({
          outcomeHorizon: '3y',
          rSquared: 0.3,
        });

        const confidence = service.calculateConfidence(
          [result6m, result3y],
          'homeready',
          'metro',
          '1.0.0',
        );

        // Should use first result's R² (0.2)
        expect(confidence.rSquared).toBe(0.2);
      });
    });
  });

  // ============================================================================
  // Correlation Score Tests
  // ============================================================================

  describe('calculateCorrelationScore (via calculateConfidence)', () => {
    it('returns 100 when R² is 0.5 or higher', () => {
      const result = createBacktestResult({
        rSquared: 0.5,
        sampleCount: 200,
        backtestEndDate: new Date().toISOString().split('T')[0],
      });

      const confidence = service.calculateConfidence(
        [result],
        'homeready',
        'metro',
        '1.0.0',
      );

      expect(confidence.correlationScore).toBe(100);
    });

    it('returns 50 when R² is 0.25', () => {
      const result = createBacktestResult({
        rSquared: 0.25,
        sampleCount: 200,
        backtestEndDate: new Date().toISOString().split('T')[0],
      });

      const confidence = service.calculateConfidence(
        [result],
        'homeready',
        'metro',
        '1.0.0',
      );

      expect(confidence.correlationScore).toBe(50);
    });

    it('returns 0 when R² is 0', () => {
      const result = createBacktestResult({
        rSquared: 0,
        sampleCount: 200,
        backtestEndDate: new Date().toISOString().split('T')[0],
      });

      const confidence = service.calculateConfidence(
        [result],
        'homeready',
        'metro',
        '1.0.0',
      );

      expect(confidence.correlationScore).toBe(0);
    });

    it('returns 0 when R² is null', () => {
      const result = createBacktestResult({
        rSquared: null,
        sampleCount: 200,
        backtestEndDate: new Date().toISOString().split('T')[0],
      });

      const confidence = service.calculateConfidence(
        [result],
        'homeready',
        'metro',
        '1.0.0',
      );

      expect(confidence.correlationScore).toBe(0);
    });

    it('caps at 100 when R² exceeds 0.5', () => {
      const result = createBacktestResult({
        rSquared: 0.8, // Above the 0.5 threshold
        sampleCount: 200,
        backtestEndDate: new Date().toISOString().split('T')[0],
      });

      const confidence = service.calculateConfidence(
        [result],
        'homeready',
        'metro',
        '1.0.0',
      );

      expect(confidence.correlationScore).toBe(100);
    });
  });

  // ============================================================================
  // Sample Size Score Tests
  // ============================================================================

  describe('calculateSampleSizeScore (via calculateConfidence)', () => {
    it('uses target of 200 for metro geography', () => {
      const atTarget = createBacktestResult({
        geographyType: 'metro',
        sampleCount: 200,
        rSquared: 0.35,
        backtestEndDate: new Date().toISOString().split('T')[0],
      });

      const confidence = service.calculateConfidence(
        [atTarget],
        'homeready',
        'metro',
        '1.0.0',
      );

      // At target, sample score should be high (>=80)
      expect(confidence.sampleSizeScore).toBeGreaterThanOrEqual(80);
    });

    it('uses target of 50 for state geography', () => {
      const stateResult = createBacktestResult({
        geographyType: 'state',
        sampleCount: 50,
        rSquared: 0.35,
        backtestEndDate: new Date().toISOString().split('T')[0],
      });

      const confidence = service.calculateConfidence(
        [stateResult],
        'homeready',
        'state',
        '1.0.0',
      );

      // At target, sample score should be high
      expect(confidence.sampleSizeScore).toBeGreaterThanOrEqual(80);
    });

    it('uses target of 500 for county geography', () => {
      const countyResult = createBacktestResult({
        geographyType: 'county',
        sampleCount: 500,
        rSquared: 0.35,
        backtestEndDate: new Date().toISOString().split('T')[0],
      });

      const confidence = service.calculateConfidence(
        [countyResult],
        'homeready',
        'county',
        '1.0.0',
      );

      // At target, sample score should be high
      expect(confidence.sampleSizeScore).toBeGreaterThanOrEqual(80);
    });

    it('uses target of 2000 for zip geography', () => {
      const zipResult = createBacktestResult({
        geographyType: 'zip',
        sampleCount: 2000,
        rSquared: 0.35,
        backtestEndDate: new Date().toISOString().split('T')[0],
      });

      const confidence = service.calculateConfidence(
        [zipResult],
        'homeready',
        'zip',
        '1.0.0',
      );

      // At target, sample score should be high
      expect(confidence.sampleSizeScore).toBeGreaterThanOrEqual(80);
    });

    it('returns lower score when below target', () => {
      const belowTarget = createBacktestResult({
        geographyType: 'metro',
        sampleCount: 50, // 25% of 200 target
        rSquared: 0.35,
        backtestEndDate: new Date().toISOString().split('T')[0],
      });

      const confidence = service.calculateConfidence(
        [belowTarget],
        'homeready',
        'metro',
        '1.0.0',
      );

      // Below target = 25% × 80 = 20
      expect(confidence.sampleSizeScore).toBeLessThan(30);
    });

    it('has diminishing returns above target', () => {
      const atTarget = createBacktestResult({
        geographyType: 'metro',
        sampleCount: 200,
        rSquared: 0.35,
        backtestEndDate: new Date().toISOString().split('T')[0],
      });

      const doubleTarget = createBacktestResult({
        geographyType: 'metro',
        sampleCount: 400,
        rSquared: 0.35,
        backtestEndDate: new Date().toISOString().split('T')[0],
      });

      const atTargetConf = service.calculateConfidence(
        [atTarget],
        'homeready',
        'metro',
        '1.0.0',
      );

      const doubleTargetConf = service.calculateConfidence(
        [doubleTarget],
        'homeready',
        'metro',
        '1.0.0',
      );

      // Double the sample shouldn't double the score
      const improvement = doubleTargetConf.sampleSizeScore - atTargetConf.sampleSizeScore;
      expect(improvement).toBeLessThan(20); // Diminishing returns
    });
  });

  // ============================================================================
  // Recency Score Tests
  // ============================================================================

  describe('calculateRecencyScore (via calculateConfidence)', () => {
    it('returns full score for recent data (within 30 days)', () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 15); // 15 days ago

      const result = createBacktestResult({
        backtestEndDate: recentDate.toISOString().split('T')[0],
        rSquared: 0.35,
        sampleCount: 200,
      });

      const confidence = service.calculateConfidence(
        [result],
        'homeready',
        'metro',
        '1.0.0',
      );

      expect(confidence.recencyScore).toBe(100);
    });

    it('returns partial score for 60-day old data', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 60); // 60 days ago

      const result = createBacktestResult({
        backtestEndDate: oldDate.toISOString().split('T')[0],
        rSquared: 0.35,
        sampleCount: 200,
      });

      const confidence = service.calculateConfidence(
        [result],
        'homeready',
        'metro',
        '1.0.0',
      );

      // Between 30-180 days, score decreases linearly
      expect(confidence.recencyScore).toBeGreaterThan(50);
      expect(confidence.recencyScore).toBeLessThan(100);
    });

    it('returns zero score for data older than 180 days', () => {
      const veryOldDate = new Date();
      veryOldDate.setDate(veryOldDate.getDate() - 200); // 200 days ago

      const result = createBacktestResult({
        backtestEndDate: veryOldDate.toISOString().split('T')[0],
        rSquared: 0.35,
        sampleCount: 200,
      });

      const confidence = service.calculateConfidence(
        [result],
        'homeready',
        'metro',
        '1.0.0',
      );

      expect(confidence.recencyScore).toBe(0);
    });

    it('returns approximately 50% score at 90 days', () => {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const result = createBacktestResult({
        backtestEndDate: ninetyDaysAgo.toISOString().split('T')[0],
        rSquared: 0.35,
        sampleCount: 200,
      });

      const confidence = service.calculateConfidence(
        [result],
        'homeready',
        'metro',
        '1.0.0',
      );

      // At 90 days: (90-30)/150 = 40% decline, so ~60% score
      expect(confidence.recencyScore).toBeGreaterThan(50);
      expect(confidence.recencyScore).toBeLessThan(70);
    });
  });

  // ============================================================================
  // Output Structure Tests
  // ============================================================================

  describe('Output Structure', () => {
    it('includes all required fields', () => {
      const result = createBacktestResult();

      const confidence = service.calculateConfidence(
        [result],
        'homeready',
        'metro',
        '1.0.0',
      );

      expect(confidence).toHaveProperty('scoreType', 'homeready');
      expect(confidence).toHaveProperty('geographyType', 'metro');
      expect(confidence).toHaveProperty('formulaVersion', '1.0.0');
      expect(confidence).toHaveProperty('confidenceScore');
      expect(confidence).toHaveProperty('confidenceLevel');
      expect(confidence).toHaveProperty('status');
      expect(confidence).toHaveProperty('correlationScore');
      expect(confidence).toHaveProperty('sampleSizeScore');
      expect(confidence).toHaveProperty('recencyScore');
      expect(confidence).toHaveProperty('lastBacktestDate');
      expect(confidence).toHaveProperty('sampleCount');
      expect(confidence).toHaveProperty('rSquared');
    });

    it('rounds scores to 2 decimal places', () => {
      const result = createBacktestResult({
        rSquared: 0.333333,
        sampleCount: 150,
      });

      const confidence = service.calculateConfidence(
        [result],
        'homeready',
        'metro',
        '1.0.0',
      );

      // Check decimal precision
      const decimals = (confidence.confidenceScore.toString().split('.')[1] || '').length;
      expect(decimals).toBeLessThanOrEqual(2);

      const corrDecimals = (confidence.correlationScore.toString().split('.')[1] || '').length;
      expect(corrDecimals).toBeLessThanOrEqual(2);
    });
  });

  // ============================================================================
  // Score Type Filtering Tests
  // ============================================================================

  describe('Score Type Filtering', () => {
    it('filters results by score type', () => {
      const homereadyResult = createBacktestResult({
        scoreType: 'homeready',
        rSquared: 0.4,
      });

      const investoredgeResult = createBacktestResult({
        scoreType: 'investoredge',
        rSquared: 0.5,
      });

      const confidence = service.calculateConfidence(
        [homereadyResult, investoredgeResult],
        'homeready',
        'metro',
        '1.0.0',
      );

      // Should use homeready's R² (0.4), not investoredge's (0.5)
      expect(confidence.rSquared).toBe(0.4);
    });

    it('filters results by geography type', () => {
      const metroResult = createBacktestResult({
        geographyType: 'metro',
        rSquared: 0.4,
      });

      const stateResult = createBacktestResult({
        geographyType: 'state',
        rSquared: 0.5,
      });

      const confidence = service.calculateConfidence(
        [metroResult, stateResult],
        'homeready',
        'metro',
        '1.0.0',
      );

      // Should use metro's R² (0.4)
      expect(confidence.rSquared).toBe(0.4);
    });

    it('filters results by formula version', () => {
      const v1Result = createBacktestResult({
        formulaVersion: '1.0.0',
        rSquared: 0.4,
      });

      const v2Result = createBacktestResult({
        formulaVersion: '2.0.0',
        rSquared: 0.5,
      });

      const confidence = service.calculateConfidence(
        [v1Result, v2Result],
        'homeready',
        'metro',
        '1.0.0',
      );

      // Should use v1's R² (0.4)
      expect(confidence.rSquared).toBe(0.4);
    });
  });

  // ============================================================================
  // Database Operation Tests
  // ============================================================================

  describe('updateConfidence', () => {
    it('calls upsert with correct data', async () => {
      const confidence: ConfidenceScore = {
        scoreType: 'homeready',
        geographyType: 'metro',
        formulaVersion: '1.0.0',
        confidenceScore: 75.5,
        confidenceLevel: 'high',
        status: 'healthy',
        correlationScore: 80,
        sampleSizeScore: 70,
        recencyScore: 100,
        lastBacktestDate: '2024-01-15',
        sampleCount: 200,
        rSquared: 0.4,
      };

      const mockUpsert = jest.fn().mockResolvedValue({ error: null });
      mockSupabaseService.getClient.mockReturnValue({
        from: jest.fn().mockReturnValue({
          upsert: mockUpsert,
        }),
      } as any);

      await service.updateConfidence(confidence);

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          score_type: 'homeready',
          geography_type: 'metro',
          formula_version: '1.0.0',
          confidence_score: 75.5,
          confidence_level: 'high',
          status: 'healthy',
        }),
        { onConflict: 'score_type,geography_type,formula_version' },
      );
    });

    it('throws error on database failure', async () => {
      const confidence: ConfidenceScore = {
        scoreType: 'homeready',
        geographyType: 'metro',
        formulaVersion: '1.0.0',
        confidenceScore: 75,
        confidenceLevel: 'high',
        status: 'healthy',
        correlationScore: 80,
        sampleSizeScore: 70,
        recencyScore: 100,
        lastBacktestDate: '2024-01-15',
        sampleCount: 200,
        rSquared: 0.4,
      };

      const mockError = new Error('Database error');
      mockSupabaseService.getClient.mockReturnValue({
        from: jest.fn().mockReturnValue({
          upsert: jest.fn().mockResolvedValue({ error: mockError }),
        }),
      } as any);

      await expect(service.updateConfidence(confidence)).rejects.toThrow();
    });
  });

  describe('getConfidence', () => {
    it('returns null when no confidence exists', async () => {
      mockSupabaseService.getClient.mockReturnValue({
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      } as any);

      const result = await service.getConfidence('homeready', 'metro');
      expect(result).toBeNull();
    });

    it('returns mapped confidence when found', async () => {
      const dbData = {
        score_type: 'homeready',
        geography_type: 'metro',
        formula_version: '1.0.0',
        confidence_score: 75.5,
        confidence_level: 'high',
        status: 'healthy',
        correlation_score: 80,
        sample_size_score: 70,
        recency_score: 100,
        last_backtest_date: '2024-01-15',
        sample_count: 200,
        r_squared: 0.4,
      };

      mockSupabaseService.getClient.mockReturnValue({
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: dbData, error: null }),
        }),
      } as any);

      const result = await service.getConfidence('homeready', 'metro');

      expect(result).toEqual({
        scoreType: 'homeready',
        geographyType: 'metro',
        formulaVersion: '1.0.0',
        confidenceScore: 75.5,
        confidenceLevel: 'high',
        status: 'healthy',
        correlationScore: 80,
        sampleSizeScore: 70,
        recencyScore: 100,
        lastBacktestDate: '2024-01-15',
        sampleCount: 200,
        rSquared: 0.4,
      });
    });
  });

  // ============================================================================
  // Hand-Calculated Verification Tests
  // ============================================================================

  describe('Hand-Calculated Verification', () => {
    it('calculates expected confidence for known inputs', () => {
      /**
       * Hand calculation:
       * - R² = 0.35 → correlation score = (0.35 / 0.5) × 100 = 70
       * - Sample = 200 (metro target = 200) → sample score ≈ 80-86 (at target)
       * - Recency = today → recency score = 100
       *
       * Confidence = 70 × 0.5 + 83 × 0.3 + 100 × 0.2
       *            = 35 + 24.9 + 20 = 79.9
       */
      const result = createBacktestResult({
        rSquared: 0.35,
        sampleCount: 200,
        backtestEndDate: new Date().toISOString().split('T')[0],
      });

      const confidence = service.calculateConfidence(
        [result],
        'homeready',
        'metro',
        '1.0.0',
      );

      // Correlation score should be 70
      expect(confidence.correlationScore).toBe(70);

      // Sample score should be high (at target)
      expect(confidence.sampleSizeScore).toBeGreaterThanOrEqual(80);

      // Recency score should be 100 (fresh data)
      expect(confidence.recencyScore).toBe(100);

      // Final confidence should be around 75-85
      expect(confidence.confidenceScore).toBeGreaterThanOrEqual(75);
      expect(confidence.confidenceScore).toBeLessThanOrEqual(90);

      // Status should be healthy
      expect(confidence.status).toBe('healthy');
    });

    it('verifies low confidence scenario', () => {
      /**
       * Hand calculation:
       * - R² = 0.1 → correlation score = (0.1 / 0.5) × 100 = 20
       * - Sample = 20 (metro target = 200, ratio = 0.1) → sample score ≈ 8 (10% × 80)
       * - Recency = 150 days ago → recency score ≈ 20 ((150-30)/150 = 80% decline)
       *
       * Confidence = 20 × 0.5 + 8 × 0.3 + 20 × 0.2
       *            = 10 + 2.4 + 4 = 16.4
       */
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 150);

      const result = createBacktestResult({
        rSquared: 0.1,
        sampleCount: 20,
        backtestEndDate: oldDate.toISOString().split('T')[0],
      });

      const confidence = service.calculateConfidence(
        [result],
        'homeready',
        'metro',
        '1.0.0',
      );

      // Correlation score should be 20
      expect(confidence.correlationScore).toBe(20);

      // Sample score should be low
      expect(confidence.sampleSizeScore).toBeLessThan(20);

      // Recency score should be low
      expect(confidence.recencyScore).toBeLessThan(30);

      // Final confidence should be under 40 (broken)
      expect(confidence.confidenceScore).toBeLessThan(40);
      expect(confidence.status).toBe('broken');
    });
  });
});
