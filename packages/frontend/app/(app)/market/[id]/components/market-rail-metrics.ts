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

/** Months of history to request for a given chart timeframe. */
export function timeFrameToHistoryMonths(tf: TimeFrame): number {
  switch (tf) {
    case "1Y":
      return 12;
    case "3Y":
      return 36;
    case "5Y":
      return 60;
    case "10Y":
      return 120;
    case "Max":
      return 240;
  }
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
