/**
 * Normalization Service Unit Tests
 *
 * Tests the three normalization methods used by PropertyIQ scoring:
 * 1. normalizeMinMax - Standard min-max scaling
 * 2. normalizePercentile - Percentile-based scoring
 * 3. normalizeOptimal - Optimal range scoring
 *
 * These tests verify:
 * - Correct calculation at boundaries
 * - Proper handling of null/undefined values
 * - Correct inversion behavior
 * - Edge cases like division by zero
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NormalizationService } from '../../normalization.service';

describe('NormalizationService', () => {
  let service: NormalizationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NormalizationService],
    }).compile();

    service = module.get<NormalizationService>(NormalizationService);
  });

  describe('normalizeMinMax', () => {
    describe('basic scaling', () => {
      it('returns 0 when value equals min', () => {
        const result = service.normalizeMinMax(0, 0, 100, false);
        expect(result).toBe(0);
      });

      it('returns 100 when value equals max', () => {
        const result = service.normalizeMinMax(100, 0, 100, false);
        expect(result).toBe(100);
      });

      it('returns 50 when value is midpoint', () => {
        const result = service.normalizeMinMax(50, 0, 100, false);
        expect(result).toBe(50);
      });

      it('calculates correct value for arbitrary range', () => {
        // Cap rate: 6.5% in range 2-12%
        const result = service.normalizeMinMax(6.5, 2, 12, false);
        // (6.5 - 2) / (12 - 2) * 100 = 45
        expect(result).toBe(45);
      });

      it('calculates correct value for negative ranges', () => {
        // YoY growth: -2% in range -10% to 10%
        const result = service.normalizeMinMax(-2, -10, 10, false);
        // (-2 - (-10)) / (10 - (-10)) * 100 = 8/20 * 100 = 40
        expect(result).toBe(40);
      });
    });

    describe('inversion (lower is better)', () => {
      it('returns 100 when value equals min and invert=true', () => {
        const result = service.normalizeMinMax(0, 0, 100, true);
        expect(result).toBe(100);
      });

      it('returns 0 when value equals max and invert=true', () => {
        const result = service.normalizeMinMax(100, 0, 100, true);
        expect(result).toBe(0);
      });

      it('correctly inverts unemployment rate', () => {
        // Unemployment 4.5% in range 2-12%
        // Normal: (4.5-2)/(12-2) * 100 = 25
        // Inverted: 100 - 25 = 75
        const result = service.normalizeMinMax(4.5, 2, 12, true);
        expect(result).toBe(75);
      });
    });

    describe('clamping behavior', () => {
      it('clamps values below min to 0', () => {
        const result = service.normalizeMinMax(-50, 0, 100, false);
        expect(result).toBe(0);
      });

      it('clamps values above max to 100', () => {
        const result = service.normalizeMinMax(150, 0, 100, false);
        expect(result).toBe(100);
      });

      it('clamps extreme negative values correctly', () => {
        const result = service.normalizeMinMax(-1000000, 0, 100, false);
        expect(result).toBe(0);
      });

      it('clamps extreme positive values correctly', () => {
        const result = service.normalizeMinMax(1000000, 0, 100, false);
        expect(result).toBe(100);
      });
    });

    describe('null/undefined handling', () => {
      it('returns 50 for null', () => {
        const result = service.normalizeMinMax(null, 0, 100, false);
        expect(result).toBe(50);
      });

      it('returns 50 for undefined', () => {
        const result = service.normalizeMinMax(undefined, 0, 100, false);
        expect(result).toBe(50);
      });

      it('returns 50 for NaN', () => {
        const result = service.normalizeMinMax(NaN, 0, 100, false);
        expect(result).toBe(50);
      });
    });

    describe('edge cases', () => {
      it('returns NaN when min equals max (known limitation)', () => {
        // When min == max, division by zero occurs: (50-50)/(50-50) = 0/0 = NaN
        // KNOWN LIMITATION: Service does not handle this edge case.
        // In practice, this should never occur with properly configured min/max ranges.
        const result = service.normalizeMinMax(50, 50, 50, false);
        expect(Number.isNaN(result)).toBe(true);
      });

      it('handles very small ranges', () => {
        const result = service.normalizeMinMax(5.001, 5, 5.01, false);
        // (5.001 - 5) / (5.01 - 5) * 100 = 0.001 / 0.01 * 100 = 10
        expect(result).toBeCloseTo(10, 0);
      });

      it('handles decimal precision correctly', () => {
        const result = service.normalizeMinMax(0.055, 0, 0.1, false);
        // (0.055 - 0) / (0.1 - 0) * 100 = 55
        expect(result).toBe(55);
      });
    });
  });

  describe('normalizePercentile', () => {
    // Standard percentile distribution for testing
    const testPercentiles: [number, number, number, number, number] = [
      200000, // p5
      300000, // p25
      400000, // p50
      550000, // p75
      800000, // p95
    ];

    describe('percentile mapping', () => {
      it('returns approximately 50 for median value', () => {
        const result = service.normalizePercentile(400000, testPercentiles, false);
        expect(result).toBe(50);
      });

      it('returns approximately 5 for p5 value', () => {
        const result = service.normalizePercentile(200000, testPercentiles, false);
        expect(result).toBe(5);
      });

      it('returns approximately 25 for p25 value', () => {
        const result = service.normalizePercentile(300000, testPercentiles, false);
        expect(result).toBe(25);
      });

      it('returns approximately 75 for p75 value', () => {
        const result = service.normalizePercentile(550000, testPercentiles, false);
        expect(result).toBe(75);
      });

      it('returns approximately 95 for p95 value', () => {
        const result = service.normalizePercentile(800000, testPercentiles, false);
        expect(result).toBe(95);
      });
    });

    describe('interpolation', () => {
      it('interpolates between p25 and p50', () => {
        // Midpoint between 300k and 400k is 350k
        const result = service.normalizePercentile(350000, testPercentiles, false);
        // Should be ~37.5 (midpoint between 25 and 50)
        expect(result).toBeCloseTo(37.5, 0);
      });

      it('interpolates between p50 and p75', () => {
        // 450k in range 400k-550k
        // (450000 - 400000) / (550000 - 400000) * 25 + 50 = 50000/150000 * 25 + 50 = 8.33 + 50 = 58.33
        const result = service.normalizePercentile(450000, testPercentiles, false);
        expect(result).toBeCloseTo(58.33, 0);
      });
    });

    describe('extreme values', () => {
      it('returns 5 for values below p5', () => {
        const result = service.normalizePercentile(100000, testPercentiles, false);
        expect(result).toBe(5);
      });

      it('returns 95 for values above p95', () => {
        const result = service.normalizePercentile(1000000, testPercentiles, false);
        expect(result).toBe(95);
      });
    });

    describe('inversion', () => {
      it('inverts the percentile correctly', () => {
        // p50 = 400k normally gives 50, inverted gives 50
        const result = service.normalizePercentile(400000, testPercentiles, true);
        expect(result).toBe(50);

        // p25 = 300k normally gives 25, inverted gives 75
        const invertedP25 = service.normalizePercentile(300000, testPercentiles, true);
        expect(invertedP25).toBe(75);
      });
    });

    describe('null/undefined handling', () => {
      it('returns 50 for null', () => {
        const result = service.normalizePercentile(null, testPercentiles, false);
        expect(result).toBe(50);
      });

      it('returns 50 for undefined', () => {
        const result = service.normalizePercentile(undefined, testPercentiles, false);
        expect(result).toBe(50);
      });
    });
  });

  describe('normalizeOptimal', () => {
    describe('optimal range (full score)', () => {
      it('returns 100 when value is within optimal range', () => {
        // Months of supply: optimal is 4-6
        const result = service.normalizeOptimal(5, 4, 6, 0, 12);
        expect(result).toBe(100);
      });

      it('returns 100 at optimal minimum boundary', () => {
        const result = service.normalizeOptimal(4, 4, 6, 0, 12);
        expect(result).toBe(100);
      });

      it('returns 100 at optimal maximum boundary', () => {
        const result = service.normalizeOptimal(6, 4, 6, 0, 12);
        expect(result).toBe(100);
      });
    });

    describe('below optimal range', () => {
      it('scales down correctly below optimal range', () => {
        // Value 2 in optimal 4-6, extreme 0-12
        // (2 - 0) / (4 - 0) * 100 = 50
        const result = service.normalizeOptimal(2, 4, 6, 0, 12);
        expect(result).toBe(50);
      });

      it('returns 0 at extreme minimum', () => {
        const result = service.normalizeOptimal(0, 4, 6, 0, 12);
        expect(result).toBe(0);
      });

      it('clamps to 0 for values below extreme minimum', () => {
        const result = service.normalizeOptimal(-5, 4, 6, 0, 12);
        expect(result).toBe(0);
      });
    });

    describe('above optimal range', () => {
      it('scales down correctly above optimal range', () => {
        // Value 8 in optimal 4-6, extreme 0-12
        // 100 - (8 - 6) / (12 - 6) * 100 = 100 - 2/6 * 100 = 100 - 33.33 = 66.67
        const result = service.normalizeOptimal(8, 4, 6, 0, 12);
        expect(result).toBeCloseTo(66.67, 0);
      });

      it('returns 0 at extreme maximum', () => {
        const result = service.normalizeOptimal(12, 4, 6, 0, 12);
        expect(result).toBe(0);
      });

      it('clamps to 0 for values above extreme maximum', () => {
        const result = service.normalizeOptimal(20, 4, 6, 0, 12);
        expect(result).toBe(0);
      });
    });

    describe('real-world examples', () => {
      it('handles ZHVI YoY correctly (optimal 2-6%)', () => {
        // Healthy growth of 4%
        expect(service.normalizeOptimal(0.04, 0.02, 0.06, -0.10, 0.20)).toBe(100);

        // Declining market -5%
        // (-0.05 - (-0.10)) / (0.02 - (-0.10)) * 100 = 0.05 / 0.12 * 100 = 41.67
        expect(service.normalizeOptimal(-0.05, 0.02, 0.06, -0.10, 0.20)).toBeCloseTo(41.67, 0);

        // Overheating 15%
        // 100 - (0.15 - 0.06) / (0.20 - 0.06) * 100 = 100 - 0.09/0.14 * 100 = 35.71
        expect(service.normalizeOptimal(0.15, 0.02, 0.06, -0.10, 0.20)).toBeCloseTo(35.71, 0);
      });

      it('handles price-to-income ratio correctly (optimal 2.5-4.0)', () => {
        // Good ratio of 3.0
        expect(service.normalizeOptimal(3.0, 2.5, 4.0, 1.0, 10.0)).toBe(100);

        // Unaffordable ratio of 7.0
        // 100 - (7.0 - 4.0) / (10.0 - 4.0) * 100 = 100 - 3/6 * 100 = 50
        expect(service.normalizeOptimal(7.0, 2.5, 4.0, 1.0, 10.0)).toBe(50);
      });
    });

    describe('null/undefined handling', () => {
      it('returns 50 for null', () => {
        const result = service.normalizeOptimal(null, 4, 6, 0, 12);
        expect(result).toBe(50);
      });

      it('returns 50 for undefined', () => {
        const result = service.normalizeOptimal(undefined, 4, 6, 0, 12);
        expect(result).toBe(50);
      });
    });
  });

  describe('normalizeWithDetails', () => {
    it('returns full result object for min_max', () => {
      const result = service.normalizeWithDetails(50, {
        method: 'min_max',
        min: 0,
        max: 100,
        invert: false,
      });

      expect(result.normalizedValue).toBe(50);
      expect(result.rawValue).toBe(50);
      expect(result.method).toBe('min_max');
      expect(result.isInverted).toBe(false);
    });

    it('returns full result object for percentile', () => {
      const result = service.normalizeWithDetails(400000, {
        method: 'percentile',
        percentiles: [200000, 300000, 400000, 550000, 800000],
        invert: false,
      });

      expect(result.normalizedValue).toBe(50);
      expect(result.rawValue).toBe(400000);
      expect(result.method).toBe('percentile');
    });

    it('returns full result object for optimal', () => {
      const result = service.normalizeWithDetails(5, {
        method: 'optimal',
        optimalMin: 4,
        optimalMax: 6,
        extremeMin: 0,
        extremeMax: 12,
      });

      expect(result.normalizedValue).toBe(100);
      expect(result.rawValue).toBe(5);
      expect(result.method).toBe('optimal');
    });

    it('throws error for percentile without percentiles array', () => {
      expect(() =>
        service.normalizeWithDetails(50, {
          method: 'percentile',
        }),
      ).toThrow('percentiles required');
    });

    it('throws error for optimal without required params', () => {
      expect(() =>
        service.normalizeWithDetails(50, {
          method: 'optimal',
          optimalMin: 4,
          // Missing other params
        }),
      ).toThrow('optimalMin, optimalMax, extremeMin, extremeMax required');
    });
  });

  describe('normalizeMetrics (batch)', () => {
    it('normalizes multiple metrics at once', () => {
      const metrics = {
        cap_rate: 0.065,
        unemployment: 4.5,
        months_supply: 5,
      };

      const configs = {
        cap_rate: { method: 'min_max' as const, min: 0.02, max: 0.12 },
        unemployment: { method: 'min_max' as const, min: 2, max: 12, invert: true },
        months_supply: {
          method: 'optimal' as const,
          optimalMin: 4,
          optimalMax: 6,
          extremeMin: 0,
          extremeMax: 12,
        },
      };

      const results = service.normalizeMetrics(metrics, configs);

      expect(results.cap_rate.normalizedValue).toBe(45);
      expect(results.unemployment.normalizedValue).toBe(75);
      expect(results.months_supply.normalizedValue).toBe(100);
    });

    it('handles missing metrics in batch', () => {
      const metrics = {
        cap_rate: null,
        unemployment: undefined,
      };

      const configs = {
        cap_rate: { method: 'min_max' as const, min: 0.02, max: 0.12 },
        unemployment: { method: 'min_max' as const, min: 2, max: 12, invert: true },
      };

      const results = service.normalizeMetrics(metrics, configs);

      expect(results.cap_rate.normalizedValue).toBe(50);
      expect(results.unemployment.normalizedValue).toBe(50);
    });
  });

  describe('score bounds verification', () => {
    it('always returns values between 0 and 100 for min_max', () => {
      const testValues = [-1000, -10, 0, 50, 100, 1000, Infinity, -Infinity];

      for (const value of testValues) {
        const result = service.normalizeMinMax(value, 0, 100, false);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(100);
      }
    });

    it('always returns values between 0 and 100 for percentile', () => {
      const percentiles: [number, number, number, number, number] = [10, 30, 50, 70, 90];
      const testValues = [-1000, 0, 50, 100, 1000];

      for (const value of testValues) {
        const result = service.normalizePercentile(value, percentiles, false);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(100);
      }
    });

    it('always returns values between 0 and 100 for optimal', () => {
      const testValues = [-1000, -10, 0, 5, 6, 10, 1000];

      for (const value of testValues) {
        const result = service.normalizeOptimal(value, 4, 6, 0, 12);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(100);
      }
    });
  });
});
