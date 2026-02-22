-- ============================================================================
-- Fix Missing Economic Columns & Add Import Indexes
-- ============================================================================
-- 1. Adds 'rpp_all_items' to all economic tables which was mysteriously missing.
-- 2. Adds B-Tree indexes to redfin_zip and propertyiq_scores to prevent the 
--    "canceling statement due to statement timeout" errors seen in the logs.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Missing Economic Columns (Regional Price Parity - All Items)
-- ============================================================================

-- Add to economic_national if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'economic_national' AND column_name = 'rpp_all_items') THEN
    ALTER TABLE economic_national ADD COLUMN rpp_all_items DECIMAL;
  END IF;
END $$;

-- Add to economic_state if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'economic_state' AND column_name = 'rpp_all_items') THEN
    ALTER TABLE economic_state ADD COLUMN rpp_all_items DECIMAL;
  END IF;
END $$;

-- Add to economic_metro if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'economic_metro' AND column_name = 'rpp_all_items') THEN
    ALTER TABLE economic_metro ADD COLUMN rpp_all_items DECIMAL;
  END IF;
END $$;

-- Add to economic_county if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'economic_county' AND column_name = 'rpp_all_items') THEN
    ALTER TABLE economic_county ADD COLUMN rpp_all_items DECIMAL;
  END IF;
END $$;

-- Fix the issue with tier_features
-- "column tier_features_tier_1.display_order does not exist"
-- The tier_features table doesn't have a display_order column, but subscription_tiers does.
-- This likely happens when PostgREST tries to automatically embed related tables.
-- Looking at subscription_tiers, it DOES have display_order. If a view or embedded query was created 
-- incorrectly referencing it on tier_features, it needs to be mapped properly. 
-- However, we can add it to tier_features just to stop the 500 error cascade while we investigate 
-- the frontend query making this bad request.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tier_features' AND column_name = 'display_order') THEN
    ALTER TABLE tier_features ADD COLUMN display_order INTEGER DEFAULT 0;
  END IF;
END $$;

-- ============================================================================
-- 2. Performance Indexes (To stop query timeouts)
-- ============================================================================

-- Indexes for the query:
-- GET /redfin_zip?select=zip_code,state_code,period_end,updated_at&order=updated_at.desc&limit=5
CREATE INDEX IF NOT EXISTS idx_redfin_zip_updated_at_desc ON redfin_zip(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_redfin_zip_period_end_desc ON redfin_zip(period_end DESC);

-- Indexes for the query:
-- GET /propertyiq_scores?select=created_at&order=created_at.desc&limit=1
CREATE INDEX IF NOT EXISTS idx_propertyiq_scores_created_at_desc ON propertyiq_scores(created_at DESC);

-- Also add helpful indexes to other massive tables while we are here:
CREATE INDEX IF NOT EXISTS idx_redfin_county_updated_at_desc ON redfin_county(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_redfin_city_updated_at_desc ON redfin_city(updated_at DESC);

COMMIT;
