// packages/backend/src/market-explorer/merge-metric-series.ts
import { MetricRow, alignSeriesToAxis } from './align-series';

export interface MetricSeriesInput {
  metric: string;
  rows: MetricRow[];
}

export interface MergedMetricSeries {
  dates: string[];
  series: Record<string, Record<string, (number | null)[]>>;
}

/**
 * Aligns each metric's raw rows to a monthly axis anchored on the latest date
 * present across ALL metrics (not each metric's own latest), so every metric
 * comes back on an identical `dates` array — no separate merge/realignment
 * step needed downstream. A metric that lags behind the others just shows
 * trailing nulls for the months it hasn't caught up on yet.
 */
export function alignAndMergeMetrics(
  perMetric: MetricSeriesInput[],
  months: number,
): MergedMetricSeries {
  let anchorDate: string | undefined;
  for (const { rows } of perMetric) {
    for (const r of rows) {
      if (!anchorDate || r.date > anchorDate) anchorDate = r.date;
    }
  }
  if (!anchorDate) return { dates: [], series: {} };

  const series: Record<string, Record<string, (number | null)[]>> = {};
  let dates: string[] = [];
  for (const { metric, rows } of perMetric) {
    const aligned = alignSeriesToAxis(rows, months, anchorDate);
    dates = aligned.dates;
    series[metric] = aligned.series;
  }
  return { dates, series };
}
