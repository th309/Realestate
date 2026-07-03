// ============================================================================
// Snapshot cache TTL math
//
// Pure, clock-injectable computation for the market-snapshot read-through
// cache. Exposed on MarketSnapshotService via a thin static delegate; the spec
// (market-snapshot-ttl.spec.ts) exercises it through that delegate.
// ============================================================================

/**
 * Snapshots are rebuilt only by the monthly data pipeline (GH Actions cron
 * "0 9 17 * *" → 17th 09:00 UTC; the import job can run up to 6h). Nothing
 * flushes the `snapshot:v1` keyspace, so this TTL is the sole refresh
 * mechanism. Rather than a flat window (which made a once-queried region
 * miss every few hours — ~28% hit rate in prod), we expire each key just
 * AFTER the next pipeline run lands new data: a region queried once stays
 * cached for the rest of the ~monthly cycle (high hit rate) while staleness
 * stays bounded to a few hours past each refresh.
 *
 * Anchor: the 17th at 21:00 UTC. Derivation: 09:00 cron start + 6h max import
 * → data lands by ~15:00; + 6h conservative buffer → 21:00 anchor. The 17th is
 * DST-stable in fixed UTC, matching the pipeline cron.
 * See redis-ttl-config.ts `metric_snapshot` for the legacy tool-cache TTL.
 */
const REFRESH_DAY_OF_MONTH = 17;
const REFRESH_HOUR_UTC = 21;
const MIN_SNAPSHOT_TTL_SECONDS = 3600; // 1h floor

/**
 * Seconds until the next monthly-pipeline refresh boundary (see above).
 * Pure function of `now` so it is unit-testable without faking the clock.
 */
export function ttlUntilNextRefresh(now: Date = new Date()): number {
  const anchor = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      REFRESH_DAY_OF_MONTH,
      REFRESH_HOUR_UTC,
      0,
      0,
    ),
  );
  // If this month's boundary has already passed, roll to next month
  // (setUTCMonth normalizes Dec → Jan of the following year).
  if (anchor.getTime() <= now.getTime()) {
    anchor.setUTCMonth(anchor.getUTCMonth() + 1);
  }
  const seconds = Math.floor((anchor.getTime() - now.getTime()) / 1000);
  return Math.max(seconds, MIN_SNAPSHOT_TTL_SECONDS);
}
