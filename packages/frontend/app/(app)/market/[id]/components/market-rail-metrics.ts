import { isMetricSupportedForGeo, type GeoLevel } from "@/lib/data";
import type { TimeFrame } from "@/app/graphs/hooks/useGraphsState";

/**
 * The secondary metrics shown in the market-detail rail and offered as
 * switchable series for the primary chart. Ordered by signal priority;
 * home_value is first so it is the default charted metric.
 */
export const RAIL_METRIC_IDS: readonly string[] = [
  "home_value",
  "rent_index",
  "cap_rate",
  "days_on_market",
  "months_of_supply",
  "home_value_yoy",
];

/**
 * Start date (YYYY-MM-DD) for a given chart timeframe, relative to today.
 * Matches the established `/graphs` conversion (see useChartData.ts) — NOT
 * `historyMonths`, which the backend timeseries route silently clamps to 6
 * months (HISTORY_MONTHS_MAX, intended for short-window trend deltas, not a
 * multi-year chart) and overwrites the response's `data` array with.
 */
export function timeFrameToStartDate(tf: TimeFrame): string {
  const startDate = new Date();
  switch (tf) {
    case "1Y":
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
    case "3Y":
      startDate.setFullYear(startDate.getFullYear() - 3);
      break;
    case "5Y":
      startDate.setFullYear(startDate.getFullYear() - 5);
      break;
    case "10Y":
      startDate.setFullYear(startDate.getFullYear() - 10);
      break;
    case "Max":
      startDate.setFullYear(2000);
      break;
  }
  return startDate.toISOString().split("T")[0];
}

/**
 * First rail metric that is supported for this geography AND has a live value,
 * preferring the configured order (home_value first). Falls back to the first
 * rail metric so the chart always has a valid selection.
 */
export function pickDefaultRailMetric(
  cards: Record<string, { value: number | null }>,
  geoType: string,
): string {
  const firstSupported = RAIL_METRIC_IDS.find(
    (id) =>
      isMetricSupportedForGeo(id, geoType as GeoLevel) &&
      cards[id]?.value != null,
  );
  return firstSupported ?? RAIL_METRIC_IDS[0];
}
