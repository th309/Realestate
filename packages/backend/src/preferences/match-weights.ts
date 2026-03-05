/**
 * Market Match Priority Weights
 *
 * Maps user-selected priority categories to the underlying metrics and
 * their relative importance within each category. Used by MarketMatchService
 * to compute a personalized weighted score.
 *
 * Metric IDs MUST correspond to entries in the MetricResolutionService
 * fallback registry (fallback-registry.ts). If a metric cannot be resolved,
 * it is skipped and remaining weights are re-normalized.
 *
 * Each priority sums to 1.0 internally. When a user selects multiple
 * priorities, their combined weights are merged and re-normalized.
 *
 * "invert" flag: true when lower raw values indicate a BETTER market
 * (e.g., unemployment_rate, days_on_market). The match scorer flips
 * the percentile so lower = higher match score.
 */

export interface MatchMetricWeight {
  /** Weight within this priority category (sums to 1.0 per category) */
  weight: number;
  /** If true, lower values are better (percentile is inverted) */
  invert: boolean;
}

export const PRIORITY_WEIGHTS: Record<
  string,
  Record<string, MatchMetricWeight>
> = {
  affordability: {
    income_to_buy: { weight: 0.4, invert: true },
    rent_index: { weight: 0.3, invert: true },
    years_to_save: { weight: 0.3, invert: true },
  },
  growth: {
    home_value_yoy: { weight: 0.35, invert: false },
    home_price_forecast: { weight: 0.35, invert: false },
    population_growth: { weight: 0.3, invert: false },
  },
  stability: {
    days_on_market: { weight: 0.5, invert: false },
    for_sale_inventory: { weight: 0.5, invert: false },
  },
  cashflow: {
    gross_yield: { weight: 0.4, invert: false },
    cap_rate: { weight: 0.35, invert: false },
    rent_index: { weight: 0.25, invert: false },
  },
  job_market: {
    unemployment_rate: { weight: 0.35, invert: true },
    job_growth: { weight: 0.35, invert: false },
    income_growth: { weight: 0.3, invert: false },
  },
};

/**
 * Get all unique metric IDs referenced across all priority categories.
 * Used to pre-fetch the full set of metrics needed for matching.
 */
export function getAllMatchMetricIds(): string[] {
  const ids = new Set<string>();
  for (const metrics of Object.values(PRIORITY_WEIGHTS)) {
    for (const metricId of Object.keys(metrics)) {
      ids.add(metricId);
    }
  }
  return [...ids];
}

/**
 * Merge multiple user priorities into a single normalized weight map.
 *
 * When a metric appears in multiple selected priorities (e.g. rent_index
 * in both affordability and cashflow), its weights are summed. The final
 * map is then re-normalized so all weights sum to 1.0.
 *
 * @param priorities - Array of priority category names selected by user
 * @returns Merged { metricId: { weight, invert } } with weights summing to 1.0
 */
export function mergePriorityWeights(
  priorities: string[],
): Record<string, MatchMetricWeight> {
  const merged: Record<string, MatchMetricWeight> = {};

  const validPriorities = priorities.filter((p) => PRIORITY_WEIGHTS[p]);
  if (validPriorities.length === 0) {
    return merged;
  }

  // Each selected priority contributes equal share (1/N of total)
  const priorityShare = 1 / validPriorities.length;

  for (const priority of validPriorities) {
    const metrics = PRIORITY_WEIGHTS[priority];
    for (const [metricId, config] of Object.entries(metrics)) {
      if (!merged[metricId]) {
        merged[metricId] = { weight: 0, invert: config.invert };
      }
      merged[metricId].weight += config.weight * priorityShare;
    }
  }

  // Re-normalize so weights sum to 1.0
  const totalWeight = Object.values(merged).reduce(
    (sum, m) => sum + m.weight,
    0,
  );
  if (totalWeight > 0) {
    for (const metricId of Object.keys(merged)) {
      merged[metricId].weight = merged[metricId].weight / totalWeight;
    }
  }

  return merged;
}
