-- Migration: Grant Zillow Metrics Table Permissions
-- Purpose: Grant INSERT, UPDATE, SELECT permissions for zillow_metrics table

-- Disable RLS
DO $$
BEGIN
    ALTER TABLE zillow_metrics DISABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN
    NULL;
END $$;

-- Grant full access to service_role
DO $$
BEGIN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE zillow_metrics TO service_role;
EXCEPTION WHEN undefined_table THEN
    NULL;
END $$;

-- Grant read access to anon and authenticated
DO $$
BEGIN
    GRANT SELECT ON TABLE zillow_metrics TO anon;
    GRANT SELECT ON TABLE zillow_metrics TO authenticated;
EXCEPTION WHEN undefined_table THEN
    NULL;
END $$;

-- Also grant on tiger_states if needed
DO $$
BEGIN
    ALTER TABLE tiger_states DISABLE ROW LEVEL SECURITY;
    GRANT SELECT, INSERT, UPDATE ON TABLE tiger_states TO service_role;
    GRANT SELECT ON TABLE tiger_states TO anon;
    GRANT SELECT ON TABLE tiger_states TO authenticated;
EXCEPTION WHEN undefined_table THEN
    NULL;
END $$;
