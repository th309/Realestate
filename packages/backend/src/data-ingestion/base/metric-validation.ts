/**
 * Per-source metric range validation.
 *
 * Consolidates the VALID_RANGES maps that previously lived inline in
 * zillow.service.ts and fred.service.ts. Out-of-range values are skipped
 * by the caller; this module is pure (no logging side-effects).
 */

export type ValidationRange = readonly [min: number, max: number];

/**
 * Source-scoped validation ranges. Keys are metric names as stored in DB.
 * A metric with no entry passes through (validation is opt-in per metric).
 */
export const VALID_RANGES_BY_SOURCE: Record<
  string,
  Record<string, ValidationRange>
> = {
  zillow: {
    zhvi: [10_000, 10_000_000],
    zori: [200, 20_000],
    zordi: [200, 20_000],
    yoy_change: [-0.5, 1.0],
    unemployment_rate: [0, 30],
    population: [100, 50_000_000],
  },
  fred: {
    mortgage_rate_30yr: [1, 25],
    mortgage_rate_15yr: [1, 25],
    unemployment_rate: [0, 30],
  },
};

/**
 * True when `value` is within the configured range for `source.metric`,
 * or when no range is configured (no-range = pass-through).
 */
export function validateMetricValue(
  source: string,
  metric: string,
  value: number,
): boolean {
  const range = VALID_RANGES_BY_SOURCE[source]?.[metric];
  if (!range) return true;
  return value >= range[0] && value <= range[1];
}
