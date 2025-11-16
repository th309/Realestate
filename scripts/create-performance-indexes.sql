-- Performance/consistency indexes for data warehouse tables
-- Run this in Supabase SQL Editor

-- Index for staging table lookups
CREATE INDEX IF NOT EXISTS ix_stg_hpi_region_period 
ON stg_redfin_hpi (region, period);

-- Index for normalization matching
CREATE INDEX IF NOT EXISTS ix_norm_link_file_raw 
ON norm_match_link (file_id, raw_name);

-- Index for fact table queries (variable + period)
CREATE INDEX IF NOT EXISTS ix_fact_var_period 
ON fact_observation (variable_id, period_start);

-- Verify indexes were created
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE indexname IN (
    'ix_stg_hpi_region_period',
    'ix_norm_link_file_raw',
    'ix_fact_var_period'
)
ORDER BY tablename, indexname;

