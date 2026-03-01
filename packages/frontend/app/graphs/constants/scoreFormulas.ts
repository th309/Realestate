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

import type { ScoreType, GeoLevel } from "@/lib/data";

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
  median_days_on_market: "Days on Market",
  demand_score: "Demand Score",
  hotness_score: "Hotness Score",
  affordability_ratio: "Affordability",
  price_reduced_share: "Price Cuts",
  pending_ratio: "Pending Ratio",
  unemployment_rate_yoy: "Unemployment Trend",
  population_yoy: "Population Growth",
  median_gross_rent: "Gross Rent",
  supply_score: "Supply Score",
  homeownership_rate: "Homeownership Rate",
};

function label(metric: string): string {
  return (
    METRIC_LABELS[metric] ??
    metric.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function w(weight: number, direction: 1 | -1, metric: string): MetricWeight {
  return { weight, direction, label: label(metric) };
}

export const SCORE_FORMULAS: Record<string, GeographyFormulas> = {
  metro: {
    homeready: {
      median_days_on_market: w(0.3096, -1, "median_days_on_market"),
      affordability_ratio: w(0.1671, 1, "affordability_ratio"),
      pending_ratio: w(0.1484, 1, "pending_ratio"),
      supply_score: w(0.1477, -1, "supply_score"),
      population_yoy: w(0.0889, 1, "population_yoy"),
      demand_score: w(0.0845, 1, "demand_score"),
      price_reduced_share: w(0.0374, -1, "price_reduced_share"),
      unemployment_rate_yoy: w(0.0164, -1, "unemployment_rate_yoy"),
    },
    investoredge: {
      median_days_on_market: w(0.2887, -1, "median_days_on_market"),
      affordability_ratio: w(0.177, 1, "affordability_ratio"),
      pending_ratio: w(0.1564, 1, "pending_ratio"),
      supply_score: w(0.1287, -1, "supply_score"),
      population_yoy: w(0.0837, 1, "population_yoy"),
      demand_score: w(0.0657, 1, "demand_score"),
      median_gross_rent: w(0.0575, -1, "median_gross_rent"),
      homeownership_rate: w(0.0423, 1, "homeownership_rate"),
    },
    markethealth: {
      hotness_score: w(0.416, 1, "hotness_score"),
      demand_score: w(0.345, 1, "demand_score"),
      pending_ratio: w(0.239, 1, "pending_ratio"),
    },
  },
  county: {
    homeready: {
      median_days_on_market: w(0.2595, -1, "median_days_on_market"),
      pending_ratio: w(0.2194, 1, "pending_ratio"),
      population_yoy: w(0.1945, 1, "population_yoy"),
      affordability_ratio: w(0.0903, -1, "affordability_ratio"),
      demand_score: w(0.0874, 1, "demand_score"),
      unemployment_rate_yoy: w(0.0759, 1, "unemployment_rate_yoy"),
      supply_score: w(0.0393, -1, "supply_score"),
      price_reduced_share: w(0.0337, 1, "price_reduced_share"),
    },
    investoredge: {
      median_days_on_market: w(0.2497, -1, "median_days_on_market"),
      pending_ratio: w(0.2115, 1, "pending_ratio"),
      population_yoy: w(0.1904, 1, "population_yoy"),
      affordability_ratio: w(0.0884, -1, "affordability_ratio"),
      median_gross_rent: w(0.0719, 1, "median_gross_rent"),
      demand_score: w(0.0641, 1, "demand_score"),
      homeownership_rate: w(0.0623, 1, "homeownership_rate"),
      unemployment_rate_yoy: w(0.0617, 1, "unemployment_rate_yoy"),
    },
    markethealth: {
      hotness_score: w(0.533, 1, "hotness_score"),
      demand_score: w(0.254, 1, "demand_score"),
      pending_ratio: w(0.213, 1, "pending_ratio"),
    },
  },
  zip: {
    homeready: {
      demand_score: w(0.3024, 1, "demand_score"),
      pending_ratio: w(0.2918, 1, "pending_ratio"),
      median_days_on_market: w(0.2049, -1, "median_days_on_market"),
      hotness_score: w(0.1393, 1, "hotness_score"),
      affordability_ratio: w(0.0312, 1, "affordability_ratio"),
      price_reduced_share: w(0.0304, 1, "price_reduced_share"),
    },
    investoredge: {
      pending_ratio: w(0.2384, 1, "pending_ratio"),
      homeownership_rate: w(0.2267, 1, "homeownership_rate"),
      median_days_on_market: w(0.1943, -1, "median_days_on_market"),
      demand_score: w(0.1912, 1, "demand_score"),
      hotness_score: w(0.1494, 1, "hotness_score"),
    },
    markethealth: {
      hotness_score: w(0.699, 1, "hotness_score"),
      demand_score: w(0.301, 1, "demand_score"),
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
  const geoKey = geoLevel === "city" ? "county" : geoLevel;
  const geoFormulas = SCORE_FORMULAS[geoKey];
  if (!geoFormulas) return null;
  return geoFormulas[scoreType] ?? null;
}
