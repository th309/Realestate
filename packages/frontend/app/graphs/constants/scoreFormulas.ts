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
    propertyiq: {},
  },
  county: {
    propertyiq: {},
  },
  zip: {
    propertyiq: {},
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
