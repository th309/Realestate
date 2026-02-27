import { MetricWithTrend, TimeSeriesPoint } from '../user-analytics.types';

export interface SessionAggregates {
  uniqueVisitors: number;
  totalSessions: number;
  avgSessionDuration: number;
  bounceRate: number;
  avgPagesPerSession: number;
  conversionRate: number;
}

/**
 * Derives all six KPI aggregates from a flat array of session rows.
 * Pure function — no I/O, no side effects.
 */
export function aggregateSessionRows(rows: any[]): SessionAggregates {
  const uniqueVisitors = new Set(rows.map((r) => r.visitor_id).filter(Boolean))
    .size;

  const totalSessions = rows.length;

  const withDuration = rows.filter((r) => (r.duration_seconds ?? 0) > 0);
  const avgSessionDuration =
    withDuration.length === 0
      ? 0
      : withDuration.reduce((sum, r) => sum + (r.duration_seconds ?? 0), 0) /
        withDuration.length;

  const bounceRate =
    totalSessions === 0
      ? 0
      : rows.filter((r) => r.is_bounce).length / totalSessions;

  const avgPagesPerSession =
    totalSessions === 0
      ? 0
      : rows.reduce((sum, r) => sum + (r.page_count ?? 0), 0) / totalSessions;

  const convertedCount = rows.filter((r) => r.converted).length;
  const conversionRate =
    totalSessions === 0 ? 0 : convertedCount / totalSessions;

  return {
    uniqueVisitors,
    totalSessions,
    avgSessionDuration,
    bounceRate,
    avgPagesPerSession,
    conversionRate,
  };
}

/**
 * Wraps current/previous values in a MetricWithTrend shape.
 * changePercent is rounded to 2 decimal places.
 * Returns 0% change when previous is zero to avoid division errors.
 */
export function buildMetricWithTrend(
  current: number,
  previous: number,
): MetricWithTrend {
  const changePercent =
    previous === 0
      ? 0
      : Math.round(((current - previous) / previous) * 10000) / 100;
  return { current, previous, changePercent };
}

/**
 * Buckets session rows by calendar date and counts distinct visitor_ids per day.
 * Returns a sorted array of TimeSeriesPoint suitable for charts and sparklines.
 */
export function groupVisitorCountsByDate(rows: any[]): TimeSeriesPoint[] {
  const byDate: Record<string, Set<string>> = {};

  for (const row of rows) {
    const date = (row.started_at as string).slice(0, 10);
    if (!byDate[date]) byDate[date] = new Set();
    if (row.visitor_id) byDate[date].add(row.visitor_id);
  }

  return Object.keys(byDate)
    .sort()
    .map((date): TimeSeriesPoint => ({ date, value: byDate[date].size }));
}
