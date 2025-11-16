-- Migration: Drop geo_data table after consolidation
-- Purpose: Remove redundant geo_data table after migration to markets
-- Date: 2024
-- 
-- WARNING: Only run this after:
-- 1. Migration 001 has been run successfully
-- 2. All data has been migrated from geo_data to markets
-- 3. All code references have been updated
-- 4. All imports are working correctly

-- ============================================================================
-- STEP 1: Verify migration is complete
-- ============================================================================

DO $$
DECLARE
    geo_data_count INTEGER;
    markets_count INTEGER;
BEGIN
    -- Check if geo_data table exists and has data
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'geo_data') THEN
        SELECT COUNT(*) INTO geo_data_count FROM geo_data;
        
        -- Get count of markets
        SELECT COUNT(*) INTO markets_count FROM markets;
        
        RAISE NOTICE 'geo_data table has % rows', geo_data_count;
        RAISE NOTICE 'markets table has % rows', markets_count;
        
        IF geo_data_count > 0 THEN
            RAISE WARNING 'geo_data table still has data! Please migrate all data before dropping.';
        END IF;
    ELSE
        RAISE NOTICE 'geo_data table does not exist, nothing to drop.';
    END IF;
END $$;

-- ============================================================================
-- STEP 2: Drop geo_data table (only if empty)
-- ============================================================================

-- Drop the table if it exists and is empty
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'geo_data') THEN
        -- Check if table is empty
        IF (SELECT COUNT(*) FROM geo_data) = 0 THEN
            DROP TABLE IF EXISTS geo_data CASCADE;
            RAISE NOTICE 'Dropped geo_data table (was empty)';
        ELSE
            RAISE WARNING 'geo_data table is not empty! Not dropping. Please migrate data first.';
        END IF;
    ELSE
        RAISE NOTICE 'geo_data table does not exist, nothing to drop.';
    END IF;
END $$;

-- ============================================================================
-- NOTES:
-- ============================================================================
-- This migration will only drop geo_data if it's empty.
-- If you need to force drop (not recommended), run manually:
--   DROP TABLE IF EXISTS geo_data CASCADE;
-- ============================================================================

