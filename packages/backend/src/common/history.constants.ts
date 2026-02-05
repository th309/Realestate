/**
 * Shared history parameters for all data types (scores, timeseries, metrics, realtor, economic, etc.).
 *
 * Convention: Any endpoint that returns period-based data SHOULD accept optional query
 * `historyMonths` (0 to HISTORY_MONTHS_MAX). When provided, include in the response:
 * - history: { data: Array<{ date, value }>, months, trend, change }
 * - current, prior, trend_change (for real-time calculations)
 *
 * Implemented in: scores (all endpoints), timeseries (getTimeSeries).
 * Other modules (realtor, economic, census, permits, zillow, metrics) can adopt the same pattern.
 */
export const HISTORY_MONTHS_MAX = 6;

/**
 * Maximum years of score history for extended historical views.
 * Used for 3-year and 5-year trend displays with outcome validation.
 */
export const SCORE_HISTORY_YEARS_MAX = 5;

/**
 * Parse and clamp historyMonths from query (e.g. "3" -> 3, "12" -> 6).
 */
export function parseHistoryMonths(value: string | undefined): number {
  if (value == null || value === '') return 0;
  const n = parseInt(value, 10);
  if (Number.isNaN(n) || n < 0) return 0;
  return Math.min(n, HISTORY_MONTHS_MAX);
}

/**
 * Parse and clamp historyYears from query (e.g. "3" -> 3, "10" -> 5).
 */
export function parseHistoryYears(value: string | undefined): number {
  if (value == null || value === '') return 0;
  const n = parseInt(value, 10);
  if (Number.isNaN(n) || n < 0) return 0;
  return Math.min(n, SCORE_HISTORY_YEARS_MAX);
}
