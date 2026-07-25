-- Insights: dedup analytics_snapshots to one row per post per day + index the
-- per-post access path.
--
-- The daily metrics pull upserts on (post_id, captured_date) so re-running a day
-- refreshes the same row instead of appending one row/post/day forever — that
-- unbounded growth is what would eventually trip the 1000-row page truncation
-- in the insights rollup. captured_date is app-set (UTC date) rather than a
-- GENERATED column because the AT TIME ZONE expression isn't IMMUTABLE.
--
-- NULL post_id (brand-level) rows are exempt from the unique index (NULLs are
-- distinct), which is intended. Additive + idempotent. Above ledger max 183849.

ALTER TABLE analytics_snapshots ADD COLUMN IF NOT EXISTS captured_date date;

CREATE UNIQUE INDEX IF NOT EXISTS uq_analytics_snapshots_post_day
  ON analytics_snapshots (post_id, captured_date);

CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_post_captured
  ON analytics_snapshots (post_id, captured_at DESC);
