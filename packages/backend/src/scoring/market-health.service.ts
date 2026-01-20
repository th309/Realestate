/**
 * Market Health Service
 *
 * Calculates the Market Health Index - a FREE tier score showing overall market conditions.
 * Components:
 * - Demand Strength (35%): Pending ratio, DOM, hotness
 * - Supply Balance (25%): Months of supply, inventory changes
 * - Price Stability (25%): Price cuts, sale-to-list, appreciation
 * - Economic Foundation (15%): Unemployment, employment growth
 */

import { Injectable } from '@nestjs/common';
import { NormalizationService } from './normalization.service';
import {
  MarketHealthComponents,
  ComponentScore,
  MetricData,
  MARKET_HEALTH_WEIGHTS,
  MARKET_HEALTH_DETAILED_METRICS,
  MetricDefinition,
} from './scoring.types';
import { MetricWithSource } from './inheritance.service';

export interface MarketHealthResult {
  score: number | null;
  components: Record<keyof MarketHealthComponents, ComponentScore>;
  completeness: number;
  status: 'complete' | 'partial' | 'unavailable';
  missingMetrics: string[];
}

@Injectable()
export class MarketHealthService {
  constructor(private readonly normalizationService: NormalizationService) {}

  /**
   * Calculate the full Market Health score
   */
  calculateScore(
    metrics: Record<string, MetricWithSource>,
  ): MarketHealthResult {
    const components: Record<keyof MarketHealthComponents, ComponentScore> = {
      demand_strength: this.calculateDemandStrength(metrics),
      supply_balance: this.calculateSupplyBalance(metrics),
      price_stability: this.calculatePriceStability(metrics),
      economic_foundation: this.calculateEconomicFoundation(metrics),
    };

    // Track missing metrics
    const missingMetrics: string[] = [];
    for (const [name, value] of Object.entries(metrics)) {
      if (value.value === null) {
        missingMetrics.push(name);
      }
    }

    // Calculate completeness
    const totalMetrics = Object.keys(metrics).length;
    const availableMetrics = totalMetrics - missingMetrics.length;
    const completeness =
      totalMetrics > 0 ? (availableMetrics / totalMetrics) * 100 : 0;

    // Determine if score is available
    let status: 'complete' | 'partial' | 'unavailable' = 'complete';
    if (completeness < 50) {
      status = 'unavailable';
    } else if (completeness < 100) {
      status = 'partial';
    }

    // Calculate final weighted score
    let score: number | null = null;
    if (status !== 'unavailable') {
      let totalWeight = 0;
      let weightedSum = 0;

      for (const [key, component] of Object.entries(components) as [
        keyof MarketHealthComponents,
        ComponentScore,
      ][]) {
        const weight = MARKET_HEALTH_WEIGHTS[key];
        if (component.score !== null) {
          weightedSum += component.score * weight;
          totalWeight += weight;
        }
      }

      score =
        totalWeight > 0
          ? Math.round((weightedSum / totalWeight) * 100) / 100
          : null;
    }

    return {
      score,
      components,
      completeness,
      status,
      missingMetrics,
    };
  }

  /**
   * Calculate Demand Strength component (35%)
   * Metrics: pending_ratio (45%), median_days_on_market (35%), hotness_score (20%)
   */
  calculateDemandStrength(
    metrics: Record<string, MetricWithSource>,
  ): ComponentScore {
    const metricDefs = MARKET_HEALTH_DETAILED_METRICS.demand_strength;
    return this.calculateComponent('demand_strength', metricDefs, metrics);
  }

  /**
   * Calculate Supply Balance component (25%)
   * Metrics: months_of_supply (40%), active_listing_count_yy (35%), new_listing_count_yy (25%)
   * Uses optimal range normalization (balanced market = best)
   */
  calculateSupplyBalance(
    metrics: Record<string, MetricWithSource>,
  ): ComponentScore {
    const metricsUsed: string[] = [];
    const helpingFactors: string[] = [];
    const hurtingFactors: string[] = [];
    let totalWeight = 0;
    let weightedSum = 0;

    // Months of supply: optimal 4-6 months
    const monthsSupply = metrics.months_of_supply?.value;
    if (monthsSupply !== null && monthsSupply !== undefined) {
      const score = this.normalizationService.normalizeOptimal(
        monthsSupply,
        4,
        6, // Optimal range
        0,
        12, // Extreme range
      );
      weightedSum += score * 0.4;
      totalWeight += 0.4;
      metricsUsed.push('months_of_supply');
      if (score >= 70) helpingFactors.push('months_of_supply');
      else if (score <= 30) hurtingFactors.push('months_of_supply');
    }

    // Active listing YoY: optimal -10% to +10%
    const inventoryYoy = metrics.active_listing_count_yy?.value;
    if (inventoryYoy !== null && inventoryYoy !== undefined) {
      const score = this.normalizationService.normalizeOptimal(
        inventoryYoy,
        -10,
        10, // Optimal range
        -50,
        50, // Extreme range
      );
      weightedSum += score * 0.35;
      totalWeight += 0.35;
      metricsUsed.push('active_listing_count_yy');
      if (score >= 70) helpingFactors.push('active_listing_count_yy');
      else if (score <= 30) hurtingFactors.push('active_listing_count_yy');
    }

    // New listing YoY: optimal -10% to +15%
    const newListingsYoy = metrics.new_listing_count_yy?.value;
    if (newListingsYoy !== null && newListingsYoy !== undefined) {
      const score = this.normalizationService.normalizeOptimal(
        newListingsYoy,
        -10,
        15, // Optimal range
        -50,
        50, // Extreme range
      );
      weightedSum += score * 0.25;
      totalWeight += 0.25;
      metricsUsed.push('new_listing_count_yy');
      if (score >= 70) helpingFactors.push('new_listing_count_yy');
      else if (score <= 30) hurtingFactors.push('new_listing_count_yy');
    }

    const finalScore =
      totalWeight > 0
        ? Math.round((weightedSum / totalWeight) * 100) / 100
        : 50;

    return {
      score: finalScore,
      weight: MARKET_HEALTH_WEIGHTS.supply_balance,
      weightedContribution:
        finalScore * MARKET_HEALTH_WEIGHTS.supply_balance,
      metricsUsed,
      helpingFactors,
      hurtingFactors,
    };
  }

  /**
   * Calculate Price Stability component (25%)
   * Metrics: price_reduced_share (40%), sale_to_list_ratio (35%), zhvi_yoy (25%)
   */
  calculatePriceStability(
    metrics: Record<string, MetricWithSource>,
  ): ComponentScore {
    const metricsUsed: string[] = [];
    const helpingFactors: string[] = [];
    const hurtingFactors: string[] = [];
    let totalWeight = 0;
    let weightedSum = 0;

    // Price reduced share: lower is better (0-40% range)
    const priceReduced = metrics.price_reduced_share?.value;
    if (priceReduced !== null && priceReduced !== undefined) {
      const score = this.normalizationService.normalizeMinMax(
        priceReduced,
        0,
        40,
        true, // Invert - lower is better
      );
      weightedSum += score * 0.4;
      totalWeight += 0.4;
      metricsUsed.push('price_reduced_share');
      if (score >= 70) helpingFactors.push('price_reduced_share');
      else if (score <= 30) hurtingFactors.push('price_reduced_share');
    }

    // Sale-to-list ratio: optimal near 1.0 (0.97-1.03)
    const saleToList = metrics.sale_to_list_ratio?.value;
    if (saleToList !== null && saleToList !== undefined) {
      const score = this.normalizationService.normalizeOptimal(
        saleToList,
        0.97,
        1.03, // Optimal range
        0.85,
        1.15, // Extreme range
      );
      weightedSum += score * 0.35;
      totalWeight += 0.35;
      metricsUsed.push('sale_to_list_ratio');
      if (score >= 70) helpingFactors.push('sale_to_list_ratio');
      else if (score <= 30) hurtingFactors.push('sale_to_list_ratio');
    }

    // ZHVI YoY: optimal 2-6% (healthy appreciation)
    const zhviYoy = metrics.zhvi_yoy?.value;
    if (zhviYoy !== null && zhviYoy !== undefined) {
      const score = this.normalizationService.normalizeOptimal(
        zhviYoy,
        2,
        6, // Optimal range (healthy appreciation)
        -10,
        20, // Extreme range
      );
      weightedSum += score * 0.25;
      totalWeight += 0.25;
      metricsUsed.push('zhvi_yoy');
      if (score >= 70) helpingFactors.push('zhvi_yoy');
      else if (score <= 30) hurtingFactors.push('zhvi_yoy');
    }

    const finalScore =
      totalWeight > 0
        ? Math.round((weightedSum / totalWeight) * 100) / 100
        : 50;

    return {
      score: finalScore,
      weight: MARKET_HEALTH_WEIGHTS.price_stability,
      weightedContribution:
        finalScore * MARKET_HEALTH_WEIGHTS.price_stability,
      metricsUsed,
      helpingFactors,
      hurtingFactors,
    };
  }

  /**
   * Calculate Economic Foundation component (15%)
   * Metrics: unemployment_rate (50%), employment_yoy (50%)
   */
  calculateEconomicFoundation(
    metrics: Record<string, MetricWithSource>,
  ): ComponentScore {
    const metricsUsed: string[] = [];
    const helpingFactors: string[] = [];
    const hurtingFactors: string[] = [];
    let totalWeight = 0;
    let weightedSum = 0;

    // Unemployment rate: lower is better (2-12% range)
    const unemployment = metrics.unemployment_rate?.value;
    if (unemployment !== null && unemployment !== undefined) {
      const score = this.normalizationService.normalizeMinMax(
        unemployment,
        2,
        12,
        true, // Invert - lower is better
      );
      weightedSum += score * 0.5;
      totalWeight += 0.5;
      metricsUsed.push('unemployment_rate');
      if (score >= 70) helpingFactors.push('unemployment_rate');
      else if (score <= 30) hurtingFactors.push('unemployment_rate');
    }

    // Employment YoY: higher is better (-5% to +5% range)
    const employmentYoy = metrics.employment_yoy?.value;
    if (employmentYoy !== null && employmentYoy !== undefined) {
      const score = this.normalizationService.normalizeMinMax(
        employmentYoy,
        -5,
        5,
        false, // Higher is better
      );
      weightedSum += score * 0.5;
      totalWeight += 0.5;
      metricsUsed.push('employment_yoy');
      if (score >= 70) helpingFactors.push('employment_yoy');
      else if (score <= 30) hurtingFactors.push('employment_yoy');
    }

    const finalScore =
      totalWeight > 0
        ? Math.round((weightedSum / totalWeight) * 100) / 100
        : 50;

    return {
      score: finalScore,
      weight: MARKET_HEALTH_WEIGHTS.economic_foundation,
      weightedContribution:
        finalScore * MARKET_HEALTH_WEIGHTS.economic_foundation,
      metricsUsed,
      helpingFactors,
      hurtingFactors,
    };
  }

  /**
   * Generic component calculation using metric definitions
   */
  private calculateComponent(
    componentName: keyof MarketHealthComponents,
    metricDefs: MetricDefinition[],
    metrics: Record<string, MetricWithSource>,
  ): ComponentScore {
    const metricsUsed: string[] = [];
    const helpingFactors: string[] = [];
    const hurtingFactors: string[] = [];
    let totalWeight = 0;
    let weightedSum = 0;

    for (const def of metricDefs) {
      const metric = metrics[def.name];

      // Handle missing values
      if (!metric || metric.value === null || metric.value === undefined) {
        if (def.nullStrategy === 'neutral') {
          totalWeight += def.weight;
          weightedSum += 50 * def.weight;
        } else if (def.nullStrategy === 'penalize') {
          totalWeight += def.weight;
          weightedSum += 25 * def.weight;
        }
        // 'skip' strategy: do nothing
        continue;
      }

      // Calculate normalized score based on direction
      let score: number;
      switch (def.direction) {
        case 'higher_better':
          score = this.getMinMaxScore(def.name, metric.value, false);
          break;
        case 'lower_better':
          score = this.getMinMaxScore(def.name, metric.value, true);
          break;
        case 'moderate_better':
          score = this.getOptimalScore(def.name, metric.value);
          break;
        default:
          score = 50;
      }

      weightedSum += score * def.weight;
      totalWeight += def.weight;
      metricsUsed.push(def.name);

      if (score >= 70) helpingFactors.push(def.name);
      else if (score <= 30) hurtingFactors.push(def.name);
    }

    const finalScore =
      totalWeight > 0
        ? Math.round((weightedSum / totalWeight) * 100) / 100
        : 50;

    return {
      score: finalScore,
      weight: MARKET_HEALTH_WEIGHTS[componentName],
      weightedContribution: finalScore * MARKET_HEALTH_WEIGHTS[componentName],
      metricsUsed,
      helpingFactors,
      hurtingFactors,
    };
  }

  /**
   * Get min-max normalized score with metric-specific ranges
   */
  private getMinMaxScore(
    metricName: string,
    value: number,
    invert: boolean,
  ): number {
    const ranges: Record<string, [number, number]> = {
      pending_ratio: [0.1, 0.8],
      median_days_on_market: [10, 120],
      hotness_score: [0, 100],
      price_reduced_share: [0, 40],
      unemployment_rate: [2, 12],
      employment_yoy: [-5, 5],
    };

    const [min, max] = ranges[metricName] || [0, 100];
    return this.normalizationService.normalizeMinMax(value, min, max, invert);
  }

  /**
   * Get optimal range score with metric-specific ranges
   */
  private getOptimalScore(metricName: string, value: number): number {
    const ranges: Record<
      string,
      { optMin: number; optMax: number; extMin: number; extMax: number }
    > = {
      months_of_supply: { optMin: 4, optMax: 6, extMin: 0, extMax: 12 },
      active_listing_count_yy: {
        optMin: -10,
        optMax: 10,
        extMin: -50,
        extMax: 50,
      },
      new_listing_count_yy: {
        optMin: -10,
        optMax: 15,
        extMin: -50,
        extMax: 50,
      },
      sale_to_list_ratio: {
        optMin: 0.97,
        optMax: 1.03,
        extMin: 0.85,
        extMax: 1.15,
      },
      zhvi_yoy: { optMin: 2, optMax: 6, extMin: -10, extMax: 20 },
    };

    const range = ranges[metricName] || {
      optMin: 40,
      optMax: 60,
      extMin: 0,
      extMax: 100,
    };
    return this.normalizationService.normalizeOptimal(
      value,
      range.optMin,
      range.optMax,
      range.extMin,
      range.extMax,
    );
  }
}
