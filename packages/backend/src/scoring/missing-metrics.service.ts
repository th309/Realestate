/**
 * Missing Metrics Handler Service
 *
 * Handles missing data scenarios in PropertyIQ scoring:
 * - Defines strategies for each metric when data is missing
 * - Implements weight redistribution logic
 * - Determines when scores become unavailable due to insufficient data
 *
 * Strategies:
 * - skip: Exclude metric, redistribute weight to remaining metrics
 * - neutral: Use neutral score (50) for missing metric
 * - penalize: Use low score (25) for missing metric
 * - required: If missing, skip entire component
 */

import { Injectable } from '@nestjs/common';
import { NullStrategy, SCORING_CONSTANTS } from './scoring.types';

export interface MissingMetricResult {
  strategy: NullStrategy;
  score: number | null;
  includeInWeight: boolean;
  message?: string;
}

export interface ComponentAvailability {
  available: boolean;
  reason?: string;
  availableWeight: number;
  totalWeight: number;
  completeness: number;
}

export interface ScoreAvailability {
  available: boolean;
  status: 'complete' | 'partial' | 'unavailable';
  reason?: string;
  completeness: number;
  missingComponents: string[];
}

// Strategy configuration for each metric
export const METRIC_MISSING_STRATEGIES: Record<string, NullStrategy> = {
  // Market Health metrics
  pending_ratio: 'neutral',
  median_days_on_market: 'neutral',
  hotness_score: 'skip',
  months_of_supply: 'neutral',
  active_listing_count_yy: 'neutral',
  new_listing_count_yy: 'skip',
  price_reduced_share: 'neutral',
  sale_to_list_ratio: 'neutral',
  zhvi_yoy: 'neutral',
  unemployment_rate: 'neutral',
  employment_yoy: 'skip',

  // HomeReady metrics - Affordability (critical)
  zhvi: 'penalize',
  zori: 'penalize',
  homeowner_income: 'neutral',
  renter_income: 'neutral',
  affordable_price: 'skip',

  // HomeReady metrics - Market Timing
  pending_listing_count_yy: 'skip',

  // HomeReady metrics - Stability
  zhvi_volatility: 'neutral',
  volatility_36m: 'neutral',
  inventory: 'neutral',
  months_supply: 'neutral',
  dom: 'neutral',
  price_cuts: 'skip',

  // HomeReady metrics - Growth Potential
  zhvi_5y_cagr: 'neutral',
  population_yoy: 'skip',
  median_household_income_yoy: 'skip',

  // HomeReady metrics - Livability
  homeownership_rate: 'neutral',
  median_age: 'skip',
  population_growth: 'neutral',
  median_income: 'skip',

  // InvestorEdge metrics - Cash Flow (critical)
  cap_rate: 'penalize',
  cap_rate_proxy: 'penalize',
  grm: 'penalize',
  rent_yield: 'penalize',
  gross_yield: 'neutral',
  rent_to_price_ratio: 'neutral',

  // InvestorEdge metrics - Rent Demand
  zori_yoy: 'neutral',
  renter_share: 'skip',

  // InvestorEdge metrics - Appreciation
  zhvi_3y_cagr: 'neutral',

  // InvestorEdge metrics - Entry Point
  overvalued_pct: 'neutral',

  // InvestorEdge metrics - Risk
  vacancy_rate: 'neutral',
  inventory_volatility: 'skip',
  inventory_surplus_pct: 'skip',
  large_multi_permits_yoy: 'skip',

  // Calculated metrics
  rent_price_ratio: 'neutral',
  price_rent_ratio: 'neutral',
};

// Metrics that are required for each component
// If any required metric is missing, the entire component is skipped
export const REQUIRED_METRICS_BY_COMPONENT: Record<string, string[]> = {
  // HomeReady
  affordability: ['zhvi', 'zori'], // Need price and rent data
  market_timing: [],
  stability: [],
  growth_potential: [],
  livability: [],

  // InvestorEdge
  cash_flow: ['zhvi', 'zori'], // Need price and rent for yield calculations
  rent_demand: ['zori'],
  appreciation: ['zhvi'],
  entry_point: [],
  risk: [],

  // Market Health
  demand_strength: [],
  supply_balance: [],
  price_stability: [],
  economic_foundation: [],
};

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

    const completeness = totalWeight > 0 ? (availableWeight / totalWeight) * 100 : 0;

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

    for (const [component, availability] of Object.entries(componentAvailability)) {
      const weight = componentWeights[component] || 0;
      totalWeight += weight;

      if (availability.available) {
        availableWeight += weight;
      } else {
        missingComponents.push(component);
      }
    }

    const completeness = totalWeight > 0 ? (availableWeight / totalWeight) * 100 : 0;
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
