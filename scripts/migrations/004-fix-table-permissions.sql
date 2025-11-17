-- Migration: Fix Table Permissions for FRED Importer
-- Purpose: Grant SELECT permissions on normalization tables to allow service role access
-- Date: 2024-12-19
--
-- This migration fixes permission denied errors when accessing:
-- - markets table
-- - tiger_states table
-- - tiger_counties table
-- - tiger_cbsa table
-- - geographic_units table
--
-- All columns use IF NOT EXISTS to allow safe re-running of the migration

-- ============================================================================
-- STEP 1: Disable RLS (Row Level Security) on normalization tables
-- ============================================================================
-- These tables contain public geographic data and should be readable by all

ALTER TABLE IF EXISTS markets DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tiger_states DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tiger_counties DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tiger_cbsa DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tiger_places DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tiger_zcta DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS geographic_units DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: Grant SELECT permissions to service_role and anon roles
-- ============================================================================
-- Service role is used by backend scripts (like FRED importer)
-- Anon role is used by public API access

-- Grant on markets table
GRANT SELECT ON TABLE markets TO service_role;
GRANT SELECT ON TABLE markets TO anon;
GRANT SELECT ON TABLE markets TO authenticated;

-- Grant on tiger_states table
GRANT SELECT ON TABLE tiger_states TO service_role;
GRANT SELECT ON TABLE tiger_states TO anon;
GRANT SELECT ON TABLE tiger_states TO authenticated;

-- Grant on tiger_counties table
GRANT SELECT ON TABLE tiger_counties TO service_role;
GRANT SELECT ON TABLE tiger_counties TO anon;
GRANT SELECT ON TABLE tiger_counties TO authenticated;

-- Grant on tiger_cbsa table
GRANT SELECT ON TABLE tiger_cbsa TO service_role;
GRANT SELECT ON TABLE tiger_cbsa TO anon;
GRANT SELECT ON TABLE tiger_cbsa TO authenticated;

-- Grant on tiger_places table
GRANT SELECT ON TABLE tiger_places TO service_role;
GRANT SELECT ON TABLE tiger_places TO anon;
GRANT SELECT ON TABLE tiger_places TO authenticated;

-- Grant on tiger_zcta table
GRANT SELECT ON TABLE tiger_zcta TO service_role;
GRANT SELECT ON TABLE tiger_zcta TO anon;
GRANT SELECT ON TABLE tiger_zcta TO authenticated;

-- Grant on geographic_units table
GRANT SELECT ON TABLE geographic_units TO service_role;
GRANT SELECT ON TABLE geographic_units TO anon;
GRANT SELECT ON TABLE geographic_units TO authenticated;

-- ============================================================================
-- STEP 3: Grant USAGE on sequences (if any tables use sequences)
-- ============================================================================
-- This is typically not needed for these tables, but included for completeness

-- ============================================================================
-- STEP 4: Verify permissions (for manual checking)
-- ============================================================================
-- Run these queries to verify permissions were granted:
--
-- SELECT tablename, schemaname, tableowner 
-- FROM pg_tables 
-- WHERE tablename IN ('markets', 'tiger_states', 'tiger_counties', 'tiger_cbsa', 'geographic_units');
--
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
-- FROM pg_policies 
-- WHERE tablename IN ('markets', 'tiger_states', 'tiger_counties', 'tiger_cbsa', 'geographic_units');
--
-- SELECT grantee, privilege_type 
-- FROM information_schema.role_table_grants 
-- WHERE table_name IN ('markets', 'tiger_states', 'tiger_counties', 'tiger_cbsa', 'geographic_units')
-- AND grantee IN ('service_role', 'anon', 'authenticated');
-- ============================================================================

