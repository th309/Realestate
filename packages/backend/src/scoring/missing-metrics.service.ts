/** Missing Metrics Handler — weight redistribution and availability checks. */

import { Injectable } from '@nestjs/common';
import { SCORING_CONSTANTS } from './scoring.types';
import type {
  MissingMetricResult,
  ComponentAvailability,
  ScoreAvailability,
} from './missing-metrics.constants';
import {
  METRIC_MISSING_STRATEGIES,
  REQUIRED_METRICS_BY_COMPONENT,
} from './missing-metrics.constants';

// Re-export types and constants for existing consumers
export type { MissingMetricResult, ComponentAvailability, ScoreAvailability };
export { METRIC_MISSING_STRATEGIES, REQUIRED_METRICS_BY_COMPONENT };

@Injectable()
export class MissingMetricsService {
  /**
   * Get the appropriate handling for a missing metric
   */
  handleMissingMetric(metricName: string): MissingMetricResult {
    const strategy = METRIC_MISSING_STRATEGIES[metricName] || 'skip';

    switch (strategy) {
      case 'skip':
        return {
          strategy,
          score: null,
          includeInWeight: false,
          message: `Metric ${metricName} unavailable, excluding from calculation`,
        };

      case 'neutral':
        return {
          strategy,
          score: 50,
          includeInWeight: true,
          message: `Metric ${metricName} unavailable, using neutral score`,
        };

      case 'penalize':
        return {
          strategy,
          score: 25,
          includeInWeight: true,
          message: `Metric ${metricName} unavailable, applying penalty score`,
        };

      default:
        return {
          strategy: 'skip',
          score: null,
          includeInWeight: false,
        };
    }
  }

  /**
   * Check if a component has sufficient data to calculate
   */
  checkComponentAvailability(
    componentName: string,
    availableMetrics: string[],
    componentMetrics: Array<{ name: string; weight: number }>,
  ): ComponentAvailability {
    // Check required metrics first
    const requiredMetrics = REQUIRED_METRICS_BY_COMPONENT[componentName] || [];
    for (const required of requiredMetrics) {
      if (!availableMetrics.includes(required)) {
        return {
          available: false,
          reason: `Required metric ${required} is missing`,
          availableWeight: 0,
          totalWeight: 1,
          completeness: 0,
        };
      }
    }

    // Calculate available weight
    let availableWeight = 0;
    let totalWeight = 0;

    for (const metric of componentMetrics) {
      totalWeight += metric.weight;

      if (availableMetrics.includes(metric.name)) {
        availableWeight += metric.weight;
      } else {
        const handling = this.handleMissingMetric(metric.name);
        if (handling.includeInWeight) {
          // Neutral/penalize strategies still count toward available weight
          availableWeight += metric.weight;
        }
      }
    }

    const completeness =
      totalWeight > 0 ? (availableWeight / totalWeight) * 100 : 0;

    // Component is unavailable if less than 50% of weighted metrics available
    const minCompleteness = SCORING_CONSTANTS.SCORE_AVAILABLE_MIN_COMPLETENESS;
    if (completeness < minCompleteness) {
      return {
        available: false,
        reason: `Only ${completeness.toFixed(0)}% of metrics available (minimum: ${minCompleteness}%)`,
        availableWeight,
        totalWeight,
        completeness,
      };
    }

    return {
      available: true,
      availableWeight,
      totalWeight,
      completeness,
    };
  }

  /**
   * Determine overall score availability based on component availability
   */
  checkScoreAvailability(
    componentAvailability: Record<string, ComponentAvailability>,
    componentWeights: Record<string, number>,
  ): ScoreAvailability {
    let availableWeight = 0;
    let totalWeight = 0;
    const missingComponents: string[] = [];

    for (const [component, availability] of Object.entries(
      componentAvailability,
    )) {
      const weight = componentWeights[component] || 0;
      totalWeight += weight;

      if (availability.available) {
        availableWeight += weight;
      } else {
        missingComponents.push(component);
      }
    }

    const completeness =
      totalWeight > 0 ? (availableWeight / totalWeight) * 100 : 0;
    const minCompleteness = SCORING_CONSTANTS.SCORE_AVAILABLE_MIN_COMPLETENESS;

    if (completeness < minCompleteness) {
      return {
        available: false,
        status: 'unavailable',
        reason: `Only ${completeness.toFixed(0)}% of score components available (minimum: ${minCompleteness}%)`,
        completeness,
        missingComponents,
      };
    }

    if (completeness < SCORING_CONSTANTS.PARTIAL_SCORE_THRESHOLD) {
      return {
        available: true,
        status: 'partial',
        reason: `Score based on ${completeness.toFixed(0)}% of data`,
        completeness,
        missingComponents,
      };
    }

    return {
      available: true,
      status: 'complete',
      completeness,
      missingComponents: [],
    };
  }

  /**
   * Redistribute weights when some metrics are skipped
   *
   * @param metrics Array of metrics with their weights
   * @param availableMetrics Set of available metric names
   * @returns New weights for available metrics (sums to 1.0)
   */
  redistributeWeights(
    metrics: Array<{ name: string; weight: number }>,
    availableMetrics: Set<string>,
  ): Map<string, number> {
    const result = new Map<string, number>();
    let totalAvailableWeight = 0;

    // First pass: calculate total available weight
    for (const metric of metrics) {
      if (availableMetrics.has(metric.name)) {
        totalAvailableWeight += metric.weight;
      } else {
        const handling = this.handleMissingMetric(metric.name);
        if (handling.includeInWeight) {
          totalAvailableWeight += metric.weight;
        }
      }
    }

    // Second pass: redistribute weights proportionally
    if (totalAvailableWeight > 0) {
      for (const metric of metrics) {
        if (availableMetrics.has(metric.name)) {
          result.set(metric.name, metric.weight / totalAvailableWeight);
        } else {
          const handling = this.handleMissingMetric(metric.name);
          if (handling.includeInWeight) {
            result.set(metric.name, metric.weight / totalAvailableWeight);
          }
        }
      }
    }

    return result;
  }

  /**
   * Get a summary of missing metrics for display
   */
  getMissingMetricsSummary(
    allMetrics: string[],
    availableMetrics: string[],
  ): {
    missing: string[];
    skipped: string[];
    neutral: string[];
    penalized: string[];
  } {
    const availableSet = new Set(availableMetrics);
    const missing = allMetrics.filter((m) => !availableSet.has(m));

    const skipped: string[] = [];
    const neutral: string[] = [];
    const penalized: string[] = [];

    for (const metric of missing) {
      const handling = this.handleMissingMetric(metric);
      switch (handling.strategy) {
        case 'skip':
          skipped.push(metric);
          break;
        case 'neutral':
          neutral.push(metric);
          break;
        case 'penalize':
          penalized.push(metric);
          break;
      }
    }

    return { missing, skipped, neutral, penalized };
  }
}
