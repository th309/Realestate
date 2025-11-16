-- Load Geographic Data in Order with Hierarchy Building
-- Order: National → States → Metros → Cities → Counties → Zip codes
-- After each level: Link to TIGER and build hierarchy

-- ============================================================================
-- STEP 1: Load National
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '📦 STEP 1: Loading National...';
    
    INSERT INTO markets (region_id, region_name, region_type, created_at)
    VALUES ('US', 'United States', 'national', NOW())
    ON CONFLICT (region_id) DO NOTHING;
    
    RAISE NOTICE '✅ National loaded: US';
END $$;

-- ============================================================================
-- STEP 2: Load States from TIGER
-- ============================================================================

DO $$
DECLARE
    states_count INTEGER;
BEGIN
    RAISE NOTICE '📦 STEP 2: Loading States from TIGER...';
    
    INSERT INTO markets (region_id, region_name, region_type, state_code, state_name, geoid, geometry, external_ids, created_at)
    SELECT 
        'US-' || ts.geoid as region_id,
        ts.name as region_name,
        'state' as region_type,
        ts.geoid as state_code,
        ts.name as state_name,
        ts.geoid as geoid,
        ts.geometry,
        jsonb_build_object('tiger_state_geoid', ts.geoid) as external_ids,
        NOW() as created_at
    FROM tiger_states ts
    ON CONFLICT (region_id) DO UPDATE SET
        region_name = EXCLUDED.region_name,
        state_code = EXCLUDED.state_code,
        state_name = EXCLUDED.state_name,
        geoid = EXCLUDED.geoid,
        geometry = EXCLUDED.geometry,
        external_ids = EXCLUDED.external_ids;
    
    GET DIAGNOSTICS states_count = ROW_COUNT;
    RAISE NOTICE '✅ Loaded % states', states_count;
    
    -- Link to TIGER
    PERFORM link_markets_to_tiger();
    RAISE NOTICE '✅ Linked markets to TIGER';
    
    -- Build hierarchy (states → national)
    PERFORM build_markets_hierarchy_from_tiger();
    RAISE NOTICE '✅ Built hierarchy relationships';
END $$;

-- ============================================================================
-- STEP 3: Load Metros (CBSA) from TIGER
-- ============================================================================

DO $$
DECLARE
    metros_count INTEGER;
BEGIN
    RAISE NOTICE '📦 STEP 3: Loading Metros (CBSA) from TIGER...';
    
    INSERT INTO markets (region_id, region_name, region_type, geoid, geometry, external_ids, created_at)
    SELECT 
        'US-MSA-' || tcbsa.geoid as region_id,
        tcbsa.name as region_name,
        'msa' as region_type,
        tcbsa.geoid as geoid,
        tcbsa.geometry,
        jsonb_build_object(
            'tiger_cbsa_geoid', tcbsa.geoid,
            'census_msa', tcbsa.geoid
        ) as external_ids,
        NOW() as created_at
    FROM tiger_cbsa tcbsa
    ON CONFLICT (region_id) DO UPDATE SET
        region_name = EXCLUDED.region_name,
        geoid = EXCLUDED.geoid,
        geometry = EXCLUDED.geometry,
        external_ids = EXCLUDED.external_ids;
    
    GET DIAGNOSTICS metros_count = ROW_COUNT;
    RAISE NOTICE '✅ Loaded % metros', metros_count;
    
    -- Link to TIGER
    PERFORM link_markets_to_tiger();
    RAISE NOTICE '✅ Linked markets to TIGER';
    
    -- Build hierarchy
    PERFORM build_markets_hierarchy_from_tiger();
    RAISE NOTICE '✅ Built hierarchy relationships';
END $$;

-- ============================================================================
-- STEP 4: Load Cities (Places) from TIGER
-- ============================================================================

DO $$
DECLARE
    cities_count INTEGER;
BEGIN
    RAISE NOTICE '📦 STEP 4: Loading Cities (Places) from TIGER...';
    
    INSERT INTO markets (region_id, region_name, region_type, state_code, geoid, geometry, external_ids, created_at)
    SELECT 
        'US-CITY-' || tp.geoid as region_id,
        tp.name as region_name,
        'city' as region_type,
        tp.state_fips as state_code,
        tp.geoid as geoid,
        tp.geometry,
        jsonb_build_object('tiger_place_geoid', tp.geoid) as external_ids,
        NOW() as created_at
    FROM tiger_places tp
    ON CONFLICT (region_id) DO UPDATE SET
        region_name = EXCLUDED.region_name,
        state_code = EXCLUDED.state_code,
        geoid = EXCLUDED.geoid,
        geometry = EXCLUDED.geometry,
        external_ids = EXCLUDED.external_ids;
    
    GET DIAGNOSTICS cities_count = ROW_COUNT;
    RAISE NOTICE '✅ Loaded % cities', cities_count;
    
    -- Link to TIGER
    PERFORM link_markets_to_tiger();
    RAISE NOTICE '✅ Linked markets to TIGER';
    
    -- Build hierarchy
    PERFORM build_markets_hierarchy_from_tiger();
    RAISE NOTICE '✅ Built hierarchy relationships';
END $$;

-- ============================================================================
-- STEP 5: Load Counties from TIGER
-- ============================================================================

DO $$
DECLARE
    counties_count INTEGER;
BEGIN
    RAISE NOTICE '📦 STEP 5: Loading Counties from TIGER...';
    
    INSERT INTO markets (region_id, region_name, region_type, state_code, county_fips, geoid, geometry, external_ids, created_at)
    SELECT 
        'US-COUNTY-' || tc.geoid as region_id,
        tc.name as region_name,
        'county' as region_type,
        tc.state_fips as state_code,
        tc.geoid as county_fips,
        tc.geoid as geoid,
        tc.geometry,
        jsonb_build_object('tiger_county_geoid', tc.geoid) as external_ids,
        NOW() as created_at
    FROM tiger_counties tc
    ON CONFLICT (region_id) DO UPDATE SET
        region_name = EXCLUDED.region_name,
        state_code = EXCLUDED.state_code,
        county_fips = EXCLUDED.county_fips,
        geoid = EXCLUDED.geoid,
        geometry = EXCLUDED.geometry,
        external_ids = EXCLUDED.external_ids;
    
    GET DIAGNOSTICS counties_count = ROW_COUNT;
    RAISE NOTICE '✅ Loaded % counties', counties_count;
    
    -- Link to TIGER
    PERFORM link_markets_to_tiger();
    RAISE NOTICE '✅ Linked markets to TIGER';
    
    -- Build hierarchy
    PERFORM build_markets_hierarchy_from_tiger();
    RAISE NOTICE '✅ Built hierarchy relationships';
END $$;

-- ============================================================================
-- STEP 6: Load Zip Codes (ZCTA) from TIGER
-- ============================================================================

DO $$
DECLARE
    zcta_count INTEGER;
    zip_count INTEGER;
BEGIN
    RAISE NOTICE '📦 STEP 6: Loading Zip Codes (ZCTA) from TIGER...';
    
    -- Check if ZCTA data exists
    SELECT COUNT(*) INTO zcta_count FROM tiger_zcta;
    
    IF zcta_count = 0 THEN
        RAISE NOTICE '⚠️  No ZCTA data in tiger_zcta table. Skipping zip codes.';
    ELSE
        INSERT INTO markets (region_id, region_name, region_type, geoid, geometry, external_ids, created_at)
        SELECT 
            'US-ZIP-' || tz.geoid as region_id,
            'ZIP ' || tz.geoid as region_name,
            'zip' as region_type,
            tz.geoid as geoid,
            tz.geometry,
            jsonb_build_object('tiger_zcta_geoid', tz.geoid) as external_ids,
            NOW() as created_at
        FROM tiger_zcta tz
        ON CONFLICT (region_id) DO UPDATE SET
            region_name = EXCLUDED.region_name,
            geoid = EXCLUDED.geoid,
            geometry = EXCLUDED.geometry,
            external_ids = EXCLUDED.external_ids;
        
        GET DIAGNOSTICS zip_count = ROW_COUNT;
        RAISE NOTICE '✅ Loaded % zip codes', zip_count;
        
        -- Link to TIGER
        PERFORM link_markets_to_tiger();
        RAISE NOTICE '✅ Linked markets to TIGER';
        
        -- Build hierarchy
        PERFORM build_markets_hierarchy_from_tiger();
        RAISE NOTICE '✅ Built hierarchy relationships';
    END IF;
END $$;

-- ============================================================================
-- FINAL: Complete hierarchy build
-- ============================================================================

DO $$
DECLARE
    final_result RECORD;
BEGIN
    RAISE NOTICE '🔗 Running final hierarchy build...';
    
    SELECT * INTO final_result FROM build_markets_hierarchy_complete();
    
    RAISE NOTICE '✅ Final hierarchy build complete';
    RAISE NOTICE '   Total relationships: %', final_result.total_relationships;
END $$;

-- ============================================================================
-- SUMMARY
-- ============================================================================

SELECT 
    region_type,
    COUNT(*) as count
FROM markets
GROUP BY region_type
ORDER BY 
    CASE region_type 
        WHEN 'national' THEN 1
        WHEN 'state' THEN 2
        WHEN 'msa' THEN 3
        WHEN 'metro' THEN 3
        WHEN 'city' THEN 4
        WHEN 'county' THEN 5
        WHEN 'zip' THEN 6
        ELSE 7
    END;

SELECT 
    COUNT(*) as total_hierarchy_relationships
FROM markets_hierarchy;




