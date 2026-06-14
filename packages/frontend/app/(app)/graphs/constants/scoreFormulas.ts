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
  zhvi_yoy: "12-Month Price Momentum",
  zhvi_mom_3m: "3-Month Price Momentum",
  median_days_on_market: "Days on Market",
  price_reduced_share: "Price Cut Share",
  demand_score: "Demand Score",
  hotness_score: "Hotness Score",
  affordability_ratio: "Affordability",
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

/**
 * PropertyIQ demand-signal formula — four equal-weighted momentum + market-flow
 * components, identical at every geography level. Keys match the z_scores JSON
 * the scoring engine writes (zhvi_yoy, zhvi_mom_3m, median_days_on_market,
 * price_reduced_share). signal = +z(yoy) +z(3m) -z(DOM) -z(price cuts).
 * Validated 2026-06-12 (docs/superpowers/results/
 * 2026-06-12-monolithic-feature-discovery.md and the three score backtests).
 */
const PROPERTYIQ_FORMULA: FormulaDefinition = {
  zhvi_yoy: w(0.25, 1, "zhvi_yoy"),
  zhvi_mom_3m: w(0.25, 1, "zhvi_mom_3m"),
  median_days_on_market: w(0.25, -1, "median_days_on_market"),
  price_reduced_share: w(0.25, -1, "price_reduced_share"),
};

export const SCORE_FORMULAS: Record<string, GeographyFormulas> = {
  metro: {
    propertyiq: PROPERTYIQ_FORMULA,
  },
  county: {
    propertyiq: PROPERTYIQ_FORMULA,
  },
  zip: {
    propertyiq: PROPERTYIQ_FORMULA,
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
