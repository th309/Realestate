/**
 * SCORE FORMULA WEIGHTS (Frontend Mirror)
 *
 * Mirrors the backend formula-weights.ts for use in the waterfall chart.
 * These define how each metric's z-score contributes to the final score.
 *
 * Direction:
 *   +1 = higher values are better (positive contribution)
 *   -1 = lower values are better (negative contribution when z > 0)
 *
 * Weight:
 *   Percentage contribution to the total score (0-1, sums to ~1.0)
 */

import type { ScoreType, GeoLevel } from '@/lib/data';

export interface MetricWeight {
  weight: number;
  direction: 1 | -1;
  /** Human-readable label for the waterfall bar */
  label: string;
}

type FormulaDefinition = Record<string, MetricWeight>;
type GeographyFormulas = Record<ScoreType, FormulaDefinition>;

/** Human-readable labels for internal metric names */
const METRIC_LABELS: Record<string, string> = {
  median_days_on_market: 'Days on Market',
  demand_score: 'Demand Score',
  hotness_score: 'Hotness Score',
  affordability_ratio: 'Affordability',
  price_reduced_share: 'Price Cuts',
  pending_ratio: 'Pending Ratio',
  unemployment_rate_yoy: 'Unemployment Trend',
  population_yoy: 'Population Growth',
  median_gross_rent: 'Gross Rent',
  supply_score: 'Supply Score',
  homeownership_rate: 'Homeownership Rate',
};

function label(metric: string): string {
  return METRIC_LABELS[metric] ?? metric.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function w(weight: number, direction: 1 | -1, metric: string): MetricWeight {
  return { weight, direction, label: label(metric) };
}

export const SCORE_FORMULAS: Record<string, GeographyFormulas> = {
  metro: {
    homeready: {
      median_days_on_market: w(0.204, -1, 'median_days_on_market'),
      demand_score:          w(0.203,  1, 'demand_score'),
      hotness_score:         w(0.169, -1, 'hotness_score'),
      affordability_ratio:   w(0.128,  1, 'affordability_ratio'),
      price_reduced_share:   w(0.099, -1, 'price_reduced_share'),
      pending_ratio:         w(0.072,  1, 'pending_ratio'),
      unemployment_rate_yoy: w(0.065, -1, 'unemployment_rate_yoy'),
      population_yoy:        w(0.060,  1, 'population_yoy'),
    },
    investoredge: {
      median_days_on_market: w(0.226, -1, 'median_days_on_market'),
      median_gross_rent:     w(0.200,  1, 'median_gross_rent'),
      supply_score:          w(0.160, -1, 'supply_score'),
      demand_score:          w(0.101,  1, 'demand_score'),
      pending_ratio:         w(0.098,  1, 'pending_ratio'),
      population_yoy:        w(0.089,  1, 'population_yoy'),
      homeownership_rate:    w(0.064, -1, 'homeownership_rate'),
      price_reduced_share:   w(0.061, -1, 'price_reduced_share'),
    },
    markethealth: {
      hotness_score:   w(0.416, 1, 'hotness_score'),
      demand_score:    w(0.345, 1, 'demand_score'),
      pending_ratio:   w(0.239, 1, 'pending_ratio'),
    },
  },
  county: {
    homeready: {
      median_days_on_market: w(0.227, -1, 'median_days_on_market'),
      pending_ratio:         w(0.207,  1, 'pending_ratio'),
      population_yoy:        w(0.192,  1, 'population_yoy'),
      demand_score:          w(0.114,  1, 'demand_score'),
      affordability_ratio:   w(0.109,  1, 'affordability_ratio'),
      supply_score:          w(0.080, -1, 'supply_score'),
      price_reduced_share:   w(0.048,  1, 'price_reduced_share'),
      unemployment_rate_yoy: w(0.024,  1, 'unemployment_rate_yoy'),
    },
    investoredge: {
      median_days_on_market: w(0.220, -1, 'median_days_on_market'),
      population_yoy:        w(0.192,  1, 'population_yoy'),
      pending_ratio:         w(0.189,  1, 'pending_ratio'),
      demand_score:          w(0.118,  1, 'demand_score'),
      affordability_ratio:   w(0.105,  1, 'affordability_ratio'),
      supply_score:          w(0.081, -1, 'supply_score'),
      median_gross_rent:     w(0.050,  1, 'median_gross_rent'),
      homeownership_rate:    w(0.046, -1, 'homeownership_rate'),
    },
    markethealth: {
      hotness_score:   w(0.533, 1, 'hotness_score'),
      demand_score:    w(0.254, 1, 'demand_score'),
      pending_ratio:   w(0.213, 1, 'pending_ratio'),
    },
  },
  zip: {
    homeready: {
      demand_score:          w(0.458,  1, 'demand_score'),
      median_days_on_market: w(0.269, -1, 'median_days_on_market'),
      pending_ratio:         w(0.232,  1, 'pending_ratio'),
      affordability_ratio:   w(0.042,  1, 'affordability_ratio'),
    },
    investoredge: {
      demand_score:          w(0.293,  1, 'demand_score'),
      median_days_on_market: w(0.216, -1, 'median_days_on_market'),
      homeownership_rate:    w(0.191,  1, 'homeownership_rate'),
      pending_ratio:         w(0.181,  1, 'pending_ratio'),
      hotness_score:         w(0.048,  1, 'hotness_score'),
      median_gross_rent:     w(0.041,  1, 'median_gross_rent'),
      price_reduced_share:   w(0.029,  1, 'price_reduced_share'),
    },
    markethealth: {
      hotness_score: w(0.699, 1, 'hotness_score'),
      demand_score:  w(0.301, 1, 'demand_score'),
    },
  },
};

/**
 * Get the formula for a specific score type and geography level.
 * Returns null if no formula exists for the combination.
 */
export function getScoreFormula(
  geoLevel: GeoLevel,
  scoreType: ScoreType,
): FormulaDefinition | null {
  const geoKey = geoLevel === 'city' ? 'county' : geoLevel;
  const geoFormulas = SCORE_FORMULAS[geoKey];
  if (!geoFormulas) return null;
  return geoFormulas[scoreType] ?? null;
}
