import type {
  AnalyticsSnapshotRow,
  InsightsTotals,
  InsightsWindow,
  PlatformInsight,
} from './insights.types';

/**
 * Pure aggregation helpers for the insights rollup. No I/O — kept separate so
 * the window math and the latest-snapshot-per-post reduction are unit-tested
 * directly.
 *
 * FORMULA (documented): reach/engagement are cumulative-per-post metrics (Late
 * returns running totals), so for a window we take each post's LATEST snapshot
 * within it and SUM across posts — never sum every daily snapshot (that would
 * multiply a post's reach by its capture count).
 */

export interface WindowPair {
  current: InsightsWindow;
  prior: InsightsWindow;
}

/** current = (now-days, now]; prior = (now-2·days, now-days]. */
export function computeWindows(now: Date, days: number): WindowPair {
  const ms = days * 24 * 60 * 60 * 1000;
  const to = now.getTime();
  const currentFrom = to - ms;
  const priorFrom = to - 2 * ms;
  return {
    current: {
      from: new Date(currentFrom).toISOString(),
      to: new Date(to).toISOString(),
    },
    prior: {
      from: new Date(priorFrom).toISOString(),
      to: new Date(currentFrom).toISOString(),
    },
  };
}

/** Keep only each post's most recent snapshot (max captured_at per post_id). */
export function latestSnapshotPerPost(
  rows: AnalyticsSnapshotRow[],
): AnalyticsSnapshotRow[] {
  const latest = new Map<string, AnalyticsSnapshotRow>();
  for (const row of rows) {
    const key = row.post_id ?? `__brand__${row.platform}`;
    const existing = latest.get(key);
    if (!existing || row.captured_at > existing.captured_at) {
      latest.set(key, row);
    }
  }
  return [...latest.values()];
}

const num = (v: number | null | undefined) => v ?? 0;

/** Window totals from a set of latest-per-post snapshots. */
export function computeTotals(latest: AnalyticsSnapshotRow[]): InsightsTotals {
  let reach = 0;
  let engagement = 0;
  let followersDelta = 0;
  const postIds = new Set<string>();
  for (const s of latest) {
    reach += num(s.reach);
    engagement += num(s.engagement);
    followersDelta += num(s.followers_delta);
    if (s.post_id) postIds.add(s.post_id);
  }
  return { reach, engagement, followersDelta, posts: postIds.size };
}

/** Per-platform rollup from latest-per-post snapshots. */
export function computePerPlatform(
  latest: AnalyticsSnapshotRow[],
): PlatformInsight[] {
  const byPlatform = new Map<string, PlatformInsight>();
  const postsSeen = new Map<string, Set<string>>();
  for (const s of latest) {
    const row = byPlatform.get(s.platform) ?? {
      platform: s.platform,
      reach: 0,
      engagement: 0,
      posts: 0,
    };
    row.reach += num(s.reach);
    row.engagement += num(s.engagement);
    byPlatform.set(s.platform, row);

    if (s.post_id) {
      const seen = postsSeen.get(s.platform) ?? new Set<string>();
      seen.add(s.post_id);
      postsSeen.set(s.platform, seen);
    }
  }
  for (const [platform, row] of byPlatform) {
    row.posts = postsSeen.get(platform)?.size ?? 0;
  }
  return [...byPlatform.values()].sort((a, b) => b.reach - a.reach);
}
