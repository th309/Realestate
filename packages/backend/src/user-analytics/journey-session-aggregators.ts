import type { DurationBucket, LandingPageMetric } from './user-analytics.types';

/**
 * Groups raw session rows by landing_page and computes per-page session count,
 * bounce rate, and average duration. Returns top 20 by session count.
 */
export function aggregateLandingPages(
  rows: {
    landing_page: string;
    is_bounce: boolean;
    duration_seconds: number;
  }[],
): LandingPageMetric[] {
  const pageMap = new Map<
    string,
    { count: number; bounces: number; totalDuration: number }
  >();

  for (const row of rows) {
    const entry = pageMap.get(row.landing_page) ?? {
      count: 0,
      bounces: 0,
      totalDuration: 0,
    };
    entry.count++;
    if (row.is_bounce) entry.bounces++;
    entry.totalDuration += row.duration_seconds ?? 0;
    pageMap.set(row.landing_page, entry);
  }

  return Array.from(pageMap.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 20)
    .map(([page, stats]) => ({
      page,
      sessions: stats.count,
      bounceRate: stats.count > 0 ? stats.bounces / stats.count : 0,
      avgDuration: stats.count > 0 ? stats.totalDuration / stats.count : 0,
    }));
}

/**
 * Computes the mean page_count across all session rows.
 */
export function computeAvgPagesPerSession(
  rows: { page_count?: number }[],
): number {
  if (rows.length === 0) return 0;
  const total = rows.reduce((sum, r) => sum + (r.page_count ?? 0), 0);
  return total / rows.length;
}

/**
 * Distributes sessions into five duration buckets:
 * <30s | 30s-2m | 2-5m | 5-10m | 10m+
 */
export function bucketSessionDurations(
  rows: { duration_seconds: number }[],
): DurationBucket[] {
  const buckets: Record<string, number> = {
    '<30s': 0,
    '30s-2m': 0,
    '2-5m': 0,
    '5-10m': 0,
    '10m+': 0,
  };

  for (const row of rows) {
    const s = row.duration_seconds ?? 0;
    if (s < 30) buckets['<30s']++;
    else if (s < 120) buckets['30s-2m']++;
    else if (s < 300) buckets['2-5m']++;
    else if (s < 600) buckets['5-10m']++;
    else buckets['10m+']++;
  }

  return Object.entries(buckets).map(([bucket, count]) => ({ bucket, count }));
}
