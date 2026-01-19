-- Migration: Consolidate Geographic Tables
-- Purpose: Migrate from geo_data to markets table, maintain hierarchy and mapping
-- Date: 2024

-- ============================================================================
-- STEP 1: Enhance markets table to support TIGER GEOID links
-- ============================================================================

-- Add GEOID field for direct linking to TIGER tables (optional, we'll use external_ids primarily)
ALTER TABLE markets ADD COLUMN IF NOT EXISTS geoid VARCHAR(20);
CREATE INDEX IF NOT EXISTS idx_markets_geoid ON markets(geoid);

-- Add index on external_ids for TIGER GEOID lookups
CREATE INDEX IF NOT EXISTS idx_markets_external_tiger_state 
    ON markets ((external_ids->>'tiger_state_geoid')) 
    WHERE external_ids->>'tiger_state_geoid' IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_markets_external_tiger_county 
    ON markets ((external_ids->>'tiger_county_geoid')) 
    WHERE external_ids->>'tiger_county_geoid' IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_markets_external_tiger_cbsa 
    ON markets ((external_ids->>'tiger_cbsa_geoid')) 
    WHERE external_ids->>'tiger_cbsa_geoid' IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_markets_external_tiger_place 
    ON markets ((external_ids->>'tiger_place_geoid')) 
    WHERE external_ids->>'tiger_place_geoid' IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_markets_external_tiger_zcta 
    ON markets ((external_ids->>'tiger_zcta_geoid')) 
    WHERE external_ids->>'tiger_zcta_geoid' IS NOT NULL;

-- ============================================================================
-- STEP 2: Migrate data from geo_data to markets (if geo_data exists)
-- ============================================================================

DO $$
BEGIN
    -- Check if geo_data table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'geo_data') THEN
        
        -- Migrate geo_data records to markets
        INSERT INTO markets (region_id, region_name, region_type, state_code, geometry, bounds, created_at)
        SELECT 
            geo_code as region_id,
            geo_name as region_name,
            geo_type as region_type,
            CASE 
                WHEN geo_code LIKE 'US-%' THEN 
                    CASE 
                        WHEN SPLIT_PART(geo_code, '-', 2) ~ '^[A-Z]{2}$' THEN SPLIT_PART(geo_code, '-', 2)
                        ELSE NULL
                    END
                ELSE NULL
            END as state_code,
            geometry,
            bounds,
            COALESCE(created_at, NOW())
        FROM geo_data
        WHERE NOT EXISTS (
            SELECT 1 FROM markets WHERE region_id = geo_data.geo_code
        )
        ON CONFLICT (region_id) DO NOTHING;
        
        RAISE NOTICE 'Migrated data from geo_data to markets';
    ELSE
        RAISE NOTICE 'geo_data table does not exist, skipping migration';
    END IF;
END $$;

-- ============================================================================
-- STEP 3: Update foreign key constraints
-- ============================================================================

-- Update time_series_data foreign key (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'time_series_data') THEN
        -- Drop old constraint if it exists
        ALTER TABLE time_series_data 
            DROP CONSTRAINT IF EXISTS time_series_data_geo_code_fkey;
        
        -- Add new constraint referencing markets
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'time_series_data_region_id_fkey'
        ) THEN
            ALTER TABLE time_series_data 
                ADD CONSTRAINT time_series_data_region_id_fkey 
                    FOREIGN KEY (geo_code) REFERENCES markets(region_id) 
                    ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- Update current_scores foreign key (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'current_scores') THEN
        ALTER TABLE current_scores 
            DROP CONSTRAINT IF EXISTS current_scores_geo_code_fkey;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'current_scores_region_id_fkey'
        ) THEN
            ALTER TABLE current_scores 
                ADD CONSTRAINT current_scores_region_id_fkey 
                    FOREIGN KEY (geo_code) REFERENCES markets(region_id) 
                    ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- Update user_favorites foreign key (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_favorites') THEN
        ALTER TABLE user_favorites 
            DROP CONSTRAINT IF EXISTS user_favorites_geo_code_fkey;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'user_favorites_region_id_fkey'
        ) THEN
            ALTER TABLE user_favorites 
                ADD CONSTRAINT user_favorites_region_id_fkey 
                    FOREIGN KEY (geo_code) REFERENCES markets(region_id) 
                    ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- Update price_alerts foreign key (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'price_alerts') THEN
        ALTER TABLE price_alerts 
            DROP CONSTRAINT IF EXISTS price_alerts_geo_code_fkey;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'price_alerts_region_id_fkey'
        ) THEN
            ALTER TABLE price_alerts 
                ADD CONSTRAINT price_alerts_region_id_fkey 
                    FOREIGN KEY (geo_code) REFERENCES markets(region_id) 
                    ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- ============================================================================
-- STEP 4: Create helper function to link markets to TIGER tables
-- ============================================================================

CREATE OR REPLACE FUNCTION get_tiger_geometry_for_market(market_region_id VARCHAR(50))
RETURNS GEOMETRY AS $$
DECLARE
    tiger_state_geoid VARCHAR(2);
    tiger_county_geoid VARCHAR(5);
    tiger_cbsa_geoid VARCHAR(5);
    tiger_place_geoid VARCHAR(7);
    tiger_zcta_geoid VARCHAR(5);
    result GEOMETRY;
    market_type VARCHAR(50);
BEGIN
    -- Get market type and TIGER GEOIDs from external_ids
    SELECT 
        region_type,
        external_ids->>'tiger_state_geoid',
        external_ids->>'tiger_county_geoid',
        external_ids->>'tiger_cbsa_geoid',
        external_ids->>'tiger_place_geoid',
        external_ids->>'tiger_zcta_geoid'
    INTO 
        market_type,
        tiger_state_geoid,
        tiger_county_geoid,
        tiger_cbsa_geoid,
        tiger_place_geoid,
        tiger_zcta_geoid
    FROM markets
    WHERE region_id = market_region_id;
    
    -- Try to get geometry from appropriate TIGER table based on market type
    -- Priority: ZCTA > Place > County > CBSA > State
    IF tiger_zcta_geoid IS NOT NULL AND EXISTS (SELECT 1 FROM tiger_zcta WHERE geoid = tiger_zcta_geoid) THEN
        SELECT geometry INTO result FROM tiger_zcta WHERE geoid = tiger_zcta_geoid;
    ELSIF tiger_place_geoid IS NOT NULL AND EXISTS (SELECT 1 FROM tiger_places WHERE geoid = tiger_place_geoid) THEN
        SELECT geometry INTO result FROM tiger_places WHERE geoid = tiger_place_geoid;
    ELSIF tiger_county_geoid IS NOT NULL AND EXISTS (SELECT 1 FROM tiger_counties WHERE geoid = tiger_county_geoid) THEN
        SELECT geometry INTO result FROM tiger_counties WHERE geoid = tiger_county_geoid;
    ELSIF tiger_cbsa_geoid IS NOT NULL AND EXISTS (SELECT 1 FROM tiger_cbsa WHERE geoid = tiger_cbsa_geoid) THEN
        SELECT geometry INTO result FROM tiger_cbsa WHERE geoid = tiger_cbsa_geoid;
    ELSIF tiger_state_geoid IS NOT NULL AND EXISTS (SELECT 1 FROM tiger_states WHERE geoid = tiger_state_geoid) THEN
        SELECT geometry INTO result FROM tiger_states WHERE geoid = tiger_state_geoid;
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 5: Create view for easy market-to-TIGER lookups
-- ============================================================================

CREATE OR REPLACE VIEW markets_with_tiger_geoids AS
SELECT 
    m.region_id,
    m.region_name,
    m.region_type,
    m.state_code,
    m.external_ids,
    m.external_ids->>'tiger_state_geoid' as tiger_state_geoid,
    m.external_ids->>'tiger_county_geoid' as tiger_county_geoid,
    m.external_ids->>'tiger_cbsa_geoid' as tiger_cbsa_geoid,
    m.external_ids->>'tiger_place_geoid' as tiger_place_geoid,
    m.external_ids->>'tiger_zcta_geoid' as tiger_zcta_geoid,
    m.geometry as market_geometry,
    get_tiger_geometry_for_market(m.region_id) as tiger_geometry,
    m.created_at,
    m.updated_at
FROM markets m;

-- ============================================================================
-- NOTES:
-- ============================================================================
-- After running this migration:
-- 1. Update all code references from geo_data to markets
-- 2. Update geo_code to region_id in code
-- 3. Test all data imports still work
-- 4. Once verified, run: DROP TABLE IF EXISTS geo_data CASCADE;
-- ============================================================================

