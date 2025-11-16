-- ============================================================================
-- Supabase Performance Optimization for Redfin Data Import
-- Run these commands in Supabase SQL Editor BEFORE starting the import
-- ============================================================================

-- 1. INCREASE MEMORY FOR THIS SESSION
-- This speeds up sorting, hashing, and index operations during bulk inserts
SET work_mem = '256MB';  -- Default is usually 4MB, increase for bulk operations
SET maintenance_work_mem = '512MB';  -- For index operations
SET effective_cache_size = '2GB';  -- Helps query planner make better decisions

-- 2. DISABLE AUTOVACUUM TEMPORARILY (if you have superuser access)
-- Autovacuum can slow down bulk inserts significantly
-- Note: Supabase may not allow this, but try it
-- ALTER TABLE market_time_series SET (autovacuum_enabled = false);
-- ALTER TABLE markets SET (autovacuum_enabled = false);

-- 3. DISABLE TRIGGERS TEMPORARILY (if any exist)
-- Check if triggers exist first:
-- SELECT trigger_name, event_manipulation, event_object_table 
-- FROM information_schema.triggers 
-- WHERE event_object_table IN ('market_time_series', 'markets');

-- If triggers exist, disable them:
-- ALTER TABLE market_time_series DISABLE TRIGGER ALL;
-- ALTER TABLE markets DISABLE TRIGGER ALL;

-- 4. DROP INDEXES TEMPORARILY (RECOMMENDED FOR LARGE IMPORTS)
-- Indexes slow down INSERT operations significantly
-- Drop indexes on market_time_series partitions you'll be inserting into

-- Drop indexes on main partitioned table (affects all partitions)
DROP INDEX IF EXISTS idx_ts_region_date;
DROP INDEX IF EXISTS idx_ts_metric;
DROP INDEX IF EXISTS idx_ts_source;
DROP INDEX IF EXISTS idx_ts_metric_region;

-- Drop indexes on specific partitions if you know which years you're importing
-- Example for 2020-2025 data:
-- DROP INDEX IF EXISTS idx_ts_region_date_2020;
-- DROP INDEX IF EXISTS idx_ts_metric_2020;
-- etc.

-- 5. INCREASE CHECKPOINT SEGMENTS (if possible)
-- This reduces checkpoint frequency during bulk loads
-- SET checkpoint_segments = 32;  -- May not be available in Supabase

-- 6. DISABLE SYNCHRONOUS COMMITS (USE WITH CAUTION)
-- This makes inserts faster but slightly less safe (data could be lost in crash)
-- Only use if you're okay with potential data loss on server crash
-- SET synchronous_commit = OFF;

-- ============================================================================
-- AFTER IMPORT: REBUILD INDEXES AND RE-ENABLE FEATURES
-- ============================================================================

-- Run these commands AFTER the import completes:

-- 1. REBUILD INDEXES (this will be faster than maintaining them during inserts)
-- CREATE INDEX CONCURRENTLY idx_ts_region_date ON market_time_series (region_id, date DESC);
-- CREATE INDEX CONCURRENTLY idx_ts_metric ON market_time_series (metric_name, date DESC);
-- CREATE INDEX CONCURRENTLY idx_ts_source ON market_time_series (data_source);
-- CREATE INDEX CONCURRENTLY idx_ts_metric_region ON market_time_series (metric_name, region_id, date DESC);

-- Note: CONCURRENTLY allows the index to be built without locking the table,
-- but it takes longer. If you can afford a brief lock, remove CONCURRENTLY.

-- 2. RE-ENABLE AUTOVACUUM
-- ALTER TABLE market_time_series SET (autovacuum_enabled = true);
-- ALTER TABLE markets SET (autovacuum_enabled = true);

-- 3. RE-ENABLE TRIGGERS
-- ALTER TABLE market_time_series ENABLE TRIGGER ALL;
-- ALTER TABLE markets ENABLE TRIGGER ALL;

-- 4. RESET SESSION SETTINGS
-- RESET work_mem;
-- RESET maintenance_work_mem;
-- RESET effective_cache_size;
-- RESET synchronous_commit;

-- 5. RUN VACUUM ANALYZE to update statistics
-- VACUUM ANALYZE market_time_series;
-- VACUUM ANALYZE markets;

-- ============================================================================
-- QUICK OPTIMIZATION (MINIMAL DOWNTIME)
-- ============================================================================
-- If you can't drop indexes, at least run these before import:

SET work_mem = '256MB';
SET maintenance_work_mem = '512MB';
SET effective_cache_size = '2GB';

-- Then after import:
-- VACUUM ANALYZE market_time_series;
-- VACUUM ANALYZE markets;











