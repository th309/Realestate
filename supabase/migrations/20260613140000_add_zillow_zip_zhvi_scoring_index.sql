-- PropertyIQ scoring reads all ZIP ZHVI for a single month, ordered by region,
-- three times per run (current, -3mo, -12mo) to derive price momentum. Without a
-- covering index the planner bitmap-scans + sorts all ~26k rows on every page of
-- the paginated fetch, which exceeds the PostgREST role statement timeout at ZIP
-- scale (the scorer's fetchPropertyIqMetrics times out).
--
-- This partial covering index serves that exact access pattern: seek by
-- period_date, scan region_name in order (no sort), value supplied from the
-- index (no heap). Deep-offset pages drop from ~250ms+sort to ~22ms index-only.
CREATE INDEX IF NOT EXISTS idx_zillow_zip_zhvi_period_region
  ON zillow_zip (period_date, region_name)
  INCLUDE (value)
  WHERE metric_name = 'zhvi';
