-- Migration: Grant Sequence Permissions
-- Purpose: Grant USAGE and SELECT permissions on sequences for Zillow import
-- Date: 2025-11-16

-- Grant permissions on market_time_series sequence
GRANT USAGE, SELECT ON SEQUENCE market_time_series_id_seq TO service_role;

