-- Migration: Grant Zillow Import Permissions
-- Purpose: Grant INSERT, UPDATE, and SELECT permissions for Zillow data import
-- Date: 2025-11-16
--
-- This migration enables the Zillow import script to:
-- - Insert/update market records in the markets table
-- - Insert/update time series data in the market_time_series table
-- - Insert logs in the data_ingestion_logs table (if it exists)
--
-- ============================================================================
-- STEP 1: Disable RLS (Row Level Security) on Zillow import tables
-- ============================================================================
-- These tables need to be writable by the service role for data imports

DO $$
BEGIN
    ALTER TABLE markets DISABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN
    NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE market_time_series DISABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN
    NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE data_ingestion_logs DISABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN
    NULL;
END $$;

-- ============================================================================
-- STEP 2: Grant INSERT, UPDATE, SELECT permissions to service_role
-- ============================================================================
-- Service role is used by backend import scripts

-- Grant on markets table (for market metadata)
DO $$
BEGIN
    GRANT SELECT, INSERT, UPDATE ON TABLE markets TO service_role;
EXCEPTION WHEN undefined_table THEN
    NULL;
END $$;

-- Grant on market_time_series table (for time series data)
DO $$
BEGIN
    GRANT SELECT, INSERT, UPDATE ON TABLE market_time_series TO service_role;
EXCEPTION WHEN undefined_table THEN
    NULL;
END $$;

-- Grant on data_ingestion_logs table (for import logging)
DO $$
BEGIN
    GRANT SELECT, INSERT, UPDATE ON TABLE data_ingestion_logs TO service_role;
EXCEPTION WHEN undefined_table THEN
    NULL;
END $$;

-- ============================================================================
-- STEP 3: Grant SELECT permissions to anon and authenticated roles
-- ============================================================================
-- These roles can read the data but not modify it

-- Grant SELECT on markets table
DO $$
BEGIN
    GRANT SELECT ON TABLE markets TO anon;
    GRANT SELECT ON TABLE markets TO authenticated;
EXCEPTION WHEN undefined_table THEN
    NULL;
END $$;

-- Grant SELECT on market_time_series table
DO $$
BEGIN
    GRANT SELECT ON TABLE market_time_series TO anon;
    GRANT SELECT ON TABLE market_time_series TO authenticated;
EXCEPTION WHEN undefined_table THEN
    NULL;
END $$;

-- Grant SELECT on data_ingestion_logs table
DO $$
BEGIN
    GRANT SELECT ON TABLE data_ingestion_logs TO anon;
    GRANT SELECT ON TABLE data_ingestion_logs TO authenticated;
EXCEPTION WHEN undefined_table THEN
    NULL;
END $$;

-- ============================================================================
-- STEP 4: Verify permissions (for manual checking)
-- ============================================================================
-- Run these queries to verify permissions were granted:
--
-- SELECT grantee, privilege_type, table_name
-- FROM information_schema.role_table_grants 
-- WHERE table_name IN ('markets', 'market_time_series', 'data_ingestion_logs')
-- AND grantee IN ('service_role', 'anon', 'authenticated')
-- ORDER BY table_name, grantee, privilege_type;
--
-- SELECT tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE tablename IN ('markets', 'market_time_series', 'data_ingestion_logs');
