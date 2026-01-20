/**
 * Normalization Service
 *
 * Provides three normalization functions for converting raw metric values
 * to a 0-100 scale for PropertyIQ scoring:
 *
 * 1. normalizeMinMax - Standard min-max scaling (higher or lower is better)
 * 2. normalizePercentile - Percentile-based scoring using distribution
 * 3. normalizeOptimal - Optimal range scoring (moderate values are best)
 */

import { Injectable } from '@nestjs/common';

export interface NormalizationResult {
  normalizedValue: number;
  rawValue: number;
  method: 'min_max' | 'percentile' | 'optimal';
  isInverted: boolean;
}

@Injectable()
export class NormalizationService {
  /**
   * Standard min-max normalization
   *
   * Scales a value to 0-100 based on a min/max range.
   * Use `invert=true` when lower values are better.
   *
   * @param value - The raw value to normalize
   * @param min - The minimum expected value (maps to 0 or 100)
   * @param max - The maximum expected value (maps to 100 or 0)
   * @param invert - If true, lower values score higher
   * @returns Normalized value 0-100
   *
   * @example
   * // Cap rate: higher is better
   * normalizeMinMax(6.5, 2, 12, false) // → 45
   *
   * // Unemployment: lower is better
   * normalizeMinMax(4.5, 2, 12, true) // → 75
   */
  normalizeMinMax(
    value: number | null | undefined,
    min: number,
    max: number,
    invert: boolean = false,
  ): number {
    // Handle null/undefined
    if (value === null || value === undefined || isNaN(value)) {
      return 50; // Neutral score for missing data
    }

    // Clamp value to range
    const clamped = Math.max(min, Math.min(max, value));

    // Normalize to 0-100
    const normalized = ((clamped - min) / (max - min)) * 100;

    // Invert if lower is better
    const result = invert ? 100 - normalized : normalized;

    // Clamp to valid range
    return Math.max(0, Math.min(100, Math.round(result * 100) / 100));
  }

  /**
   * Percentile-based normalization
   *
   * Maps a value to its percentile position within a distribution.
   * Useful when you have pre-computed percentile breakpoints.
   *
   * @param value - The raw value to normalize
   * @param percentiles - Array of [p5, p25, p50, p75, p95] breakpoints
   * @param invert - If true, lower values score higher
   * @returns Normalized value 0-100
   *
   * @example
   * // Home price percentiles for metros
   * normalizePercentile(450000, [200000, 300000, 400000, 550000, 800000])
   * // → approximately 55 (between p50 and p75)
   */
  normalizePercentile(
    value: number | null | undefined,
    percentiles: [number, number, number, number, number],
    invert: boolean = false,
  ): number {
    // Handle null/undefined
    if (value === null || value === undefined || isNaN(value)) {
      return 50; // Neutral score
    }

    const [p5, p25, p50, p75, p95] = percentiles;

    let score: number;

    if (value <= p5) {
      score = 5;
    } else if (value <= p25) {
      // Interpolate between 5 and 25
      score = 5 + ((value - p5) / (p25 - p5)) * 20;
    } else if (value <= p50) {
      // Interpolate between 25 and 50
      score = 25 + ((value - p25) / (p50 - p25)) * 25;
    } else if (value <= p75) {
      // Interpolate between 50 and 75
      score = 50 + ((value - p50) / (p75 - p50)) * 25;
    } else if (value <= p95) {
      // Interpolate between 75 and 95
      score = 75 + ((value - p75) / (p95 - p75)) * 20;
    } else {
      score = 95;
    }

    const result = invert ? 100 - score : score;

    return Math.max(0, Math.min(100, Math.round(result * 100) / 100));
  }

  /**
   * Optimal range normalization
   *
   * Scores highest (100) within an optimal range, decreasing towards extremes.
   * Useful for metrics where moderate values are best.
   *
   * @param value - The raw value to normalize
   * @param optimalMin - Start of optimal range (100 score)
   * @param optimalMax - End of optimal range (100 score)
   * @param extremeMin - Minimum extreme (0 score)
   * @param extremeMax - Maximum extreme (0 score)
   * @returns Normalized value 0-100
   *
   * @example
   * // Months of supply: optimal is 4-6 months
   * normalizeOptimal(5, 4, 6, 0, 12) // → 100 (within optimal)
   * normalizeOptimal(8, 4, 6, 0, 12) // → ~67 (above optimal)
   * normalizeOptimal(2, 4, 6, 0, 12) // → 50 (below optimal)
   *
   * // ZHVI YoY: optimal is 2-6% appreciation
   * normalizeOptimal(4, 2, 6, -10, 20) // → 100 (healthy growth)
   * normalizeOptimal(15, 2, 6, -10, 20) // → ~36 (overheating)
   */
  normalizeOptimal(
    value: number | null | undefined,
    optimalMin: number,
    optimalMax: number,
    extremeMin: number,
    extremeMax: number,
  ): number {
    // Handle null/undefined
    if (value === null || value === undefined || isNaN(value)) {
      return 50; // Neutral score
    }

    // Within optimal range: full score
    if (value >= optimalMin && value <= optimalMax) {
      return 100;
    }

    // Below optimal range
    if (value < optimalMin) {
      // Clamp to extreme minimum
      const clampedValue = Math.max(extremeMin, value);
      // Calculate score: 0 at extremeMin, 100 at optimalMin
      const score =
        ((clampedValue - extremeMin) / (optimalMin - extremeMin)) * 100;
      return Math.max(0, Math.min(100, Math.round(score * 100) / 100));
    }

    // Above optimal range
    // Clamp to extreme maximum
    const clampedValue = Math.min(extremeMax, value);
    // Calculate score: 100 at optimalMax, 0 at extremeMax
    const score =
      100 - ((clampedValue - optimalMax) / (extremeMax - optimalMax)) * 100;
    return Math.max(0, Math.min(100, Math.round(score * 100) / 100));
  }

  /**
   * Normalize with full result object (for detailed tracking)
   */
  normalizeWithDetails(
    value: number | null | undefined,
    config: {
      method: 'min_max' | 'percentile' | 'optimal';
      min?: number;
      max?: number;
      invert?: boolean;
      percentiles?: [number, number, number, number, number];
      optimalMin?: number;
      optimalMax?: number;
      extremeMin?: number;
      extremeMax?: number;
    },
  ): NormalizationResult {
    let normalizedValue: number;

    switch (config.method) {
      case 'min_max':
        normalizedValue = this.normalizeMinMax(
          value,
          config.min ?? 0,
          config.max ?? 100,
          config.invert ?? false,
        );
        break;

      case 'percentile':
        if (!config.percentiles) {
          throw new Error('percentiles required for percentile normalization');
        }
        normalizedValue = this.normalizePercentile(
          value,
          config.percentiles,
          config.invert ?? false,
        );
        break;

      case 'optimal':
        if (
          config.optimalMin === undefined ||
          config.optimalMax === undefined ||
          config.extremeMin === undefined ||
          config.extremeMax === undefined
        ) {
          throw new Error(
            'optimalMin, optimalMax, extremeMin, extremeMax required for optimal normalization',
          );
        }
        normalizedValue = this.normalizeOptimal(
          value,
          config.optimalMin,
          config.optimalMax,
          config.extremeMin,
          config.extremeMax,
        );
        break;

      default:
        normalizedValue = 50;
    }

    return {
      normalizedValue,
      rawValue: value ?? 0,
      method: config.method,
      isInverted: config.invert ?? false,
    };
  }

  /**
   * Batch normalize multiple metrics
   */
  normalizeMetrics(
    metrics: Record<string, number | null | undefined>,
    configs: Record<
      string,
      {
        method: 'min_max' | 'percentile' | 'optimal';
        min?: number;
        max?: number;
        invert?: boolean;
        percentiles?: [number, number, number, number, number];
        optimalMin?: number;
        optimalMax?: number;
        extremeMin?: number;
        extremeMax?: number;
      }
    >,
  ): Record<string, NormalizationResult> {
    const results: Record<string, NormalizationResult> = {};

    for (const [metricName, config] of Object.entries(configs)) {
      const value = metrics[metricName];
      results[metricName] = this.normalizeWithDetails(value, config);
    }

    return results;
  }
}
