-- Migration: Grant permissions on metric_percentiles table
-- Description: Grants INSERT, UPDATE, DELETE permissions that were missing from migration 030
-- Date: 2025-01-22

-- Grant full access to authenticated users (service role)
GRANT SELECT, INSERT, UPDATE, DELETE ON metric_percentiles TO authenticated;

-- Grant read access to anonymous users
GRANT SELECT ON metric_percentiles TO anon;

-- Also grant to service_role explicitly
GRANT ALL ON metric_percentiles TO service_role;
