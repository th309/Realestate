-- Build Geographic Hierarchy Table
-- This creates a denormalized table for fast geographic hierarchy lookups

-- ============================================================================
-- STEP 1: Create Hierarchy Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS geo_hierarchy (
    geoid VARCHAR(20) PRIMARY KEY,
    geo_type VARCHAR(20) NOT NULL,  -- 'zip', 'place', 'county', 'cbsa', 'state'
    
    -- Direct parents (most common relationships)
    primary_state_geoid VARCHAR(2),
    primary_county_geoid VARCHAR(5),
    primary_place_geoid VARCHAR(7),
    primary_cbsa_geoid VARCHAR(5),
    
    -- All relationships (JSONB arrays for multiple relationships)
    all_states JSONB DEFAULT '[]',
    all_counties JSONB DEFAULT '[]',
    all_places JSONB DEFAULT '[]',
    all_cbsas JSONB DEFAULT '[]',
    
    -- Hierarchy path (for easy traversal)
    -- Example: ["US", "17", "16980", "1714000", "60007"]
    hierarchy_path TEXT[],
    
    -- Metadata
    name VARCHAR(255),
    population BIGINT,
    area_sqkm DECIMAL(12,2),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_geo_hierarchy_type ON geo_hierarchy(geo_type);
CREATE INDEX IF NOT EXISTS idx_geo_hierarchy_state ON geo_hierarchy(primary_state_geoid);
CREATE INDEX IF NOT EXISTS idx_geo_hierarchy_county ON geo_hierarchy(primary_county_geoid);
CREATE INDEX IF NOT EXISTS idx_geo_hierarchy_cbsa ON geo_hierarchy(primary_cbsa_geoid);
CREATE INDEX IF NOT EXISTS idx_geo_hierarchy_place ON geo_hierarchy(primary_place_geoid);
CREATE INDEX IF NOT EXISTS idx_geo_hierarchy_path ON geo_hierarchy USING GIN(hierarchy_path);
CREATE INDEX IF NOT EXISTS idx_geo_hierarchy_states_jsonb ON geo_hierarchy USING GIN(all_states);
CREATE INDEX IF NOT EXISTS idx_geo_hierarchy_counties_jsonb ON geo_hierarchy USING GIN(all_counties);

-- ============================================================================
-- STEP 2: Populate States
-- ============================================================================

INSERT INTO geo_hierarchy (geoid, geo_type, name, primary_state_geoid, hierarchy_path, area_sqkm)
SELECT 
    s.geoid,
    'state' as geo_type,
    s.name,
    s.geoid as primary_state_geoid,
    ARRAY['US', s.geoid] as hierarchy_path,
    ST_Area(ST_Transform(s.geometry, 3857)) / 1000000 as area_sqkm
FROM tiger_states s
ON CONFLICT (geoid) DO UPDATE SET
    name = EXCLUDED.name,
    primary_state_geoid = EXCLUDED.primary_state_geoid,
    hierarchy_path = EXCLUDED.hierarchy_path,
    area_sqkm = EXCLUDED.area_sqkm,
    updated_at = NOW();

-- ============================================================================
-- STEP 3: Populate Counties
-- ============================================================================

INSERT INTO geo_hierarchy (geoid, geo_type, name, primary_state_geoid, primary_county_geoid, 
                          all_states, all_counties, hierarchy_path, area_sqkm)
SELECT 
    c.geoid,
    'county' as geo_type,
    c.name,
    SUBSTRING(c.geoid, 1, 2) as primary_state_geoid,
    c.geoid as primary_county_geoid,
    jsonb_build_array(SUBSTRING(c.geoid, 1, 2)) as all_states,
    jsonb_build_array(c.geoid) as all_counties,
    ARRAY['US', SUBSTRING(c.geoid, 1, 2), c.geoid] as hierarchy_path,
    ST_Area(ST_Transform(c.geometry, 3857)) / 1000000 as area_sqkm
FROM tiger_counties c
ON CONFLICT (geoid) DO UPDATE SET
    name = EXCLUDED.name,
    primary_state_geoid = EXCLUDED.primary_state_geoid,
    primary_county_geoid = EXCLUDED.primary_county_geoid,
    all_states = EXCLUDED.all_states,
    all_counties = EXCLUDED.all_counties,
    hierarchy_path = EXCLUDED.hierarchy_path,
    area_sqkm = EXCLUDED.area_sqkm,
    updated_at = NOW();

-- ============================================================================
-- STEP 4: Populate CBSAs
-- ============================================================================

INSERT INTO geo_hierarchy (geoid, geo_type, name, primary_state_geoid, primary_cbsa_geoid,
                          all_states, all_cbsas, hierarchy_path, area_sqkm)
SELECT 
    cbsa.geoid,
    'cbsa' as geo_type,
    cbsa.name,
    -- Get the most common state for this CBSA
    (SELECT state_geoid 
     FROM geo_county_cbsa gcc
     JOIN geo_county_state gcs ON gcc.county_geoid = gcs.county_geoid
     WHERE gcc.cbsa_geoid = cbsa.geoid AND gcc.is_primary = true
     GROUP BY state_geoid
     ORDER BY COUNT(*) DESC
     LIMIT 1) as primary_state_geoid,
    cbsa.geoid as primary_cbsa_geoid,
    -- Get all states this CBSA spans
    (SELECT jsonb_agg(DISTINCT state_geoid)
     FROM geo_county_cbsa gcc
     JOIN geo_county_state gcs ON gcc.county_geoid = gcs.county_geoid
     WHERE gcc.cbsa_geoid = cbsa.geoid) as all_states,
    jsonb_build_array(cbsa.geoid) as all_cbsas,
    ARRAY['US', 
          (SELECT state_geoid 
           FROM geo_county_cbsa gcc
           JOIN geo_county_state gcs ON gcc.county_geoid = gcs.county_geoid
           WHERE gcc.cbsa_geoid = cbsa.geoid AND gcc.is_primary = true
           GROUP BY state_geoid
           ORDER BY COUNT(*) DESC
           LIMIT 1),
          cbsa.geoid] as hierarchy_path,
    ST_Area(ST_Transform(cbsa.geometry, 3857)) / 1000000 as area_sqkm
FROM tiger_cbsa cbsa
ON CONFLICT (geoid) DO UPDATE SET
    name = EXCLUDED.name,
    primary_state_geoid = EXCLUDED.primary_state_geoid,
    primary_cbsa_geoid = EXCLUDED.primary_cbsa_geoid,
    all_states = EXCLUDED.all_states,
    all_cbsas = EXCLUDED.all_cbsas,
    hierarchy_path = EXCLUDED.hierarchy_path,
    area_sqkm = EXCLUDED.area_sqkm,
    updated_at = NOW();

-- ============================================================================
-- STEP 5: Populate Places
-- ============================================================================

INSERT INTO geo_hierarchy (geoid, geo_type, name, primary_state_geoid, primary_county_geoid, 
                          primary_place_geoid, all_states, all_counties, all_places, hierarchy_path, area_sqkm)
SELECT 
    p.geoid,
    'place' as geo_type,
    p.name,
    SUBSTRING(p.geoid, 1, 2) as primary_state_geoid,
    (SELECT county_geoid 
     FROM geo_place_county gpc
     WHERE gpc.place_geoid = p.geoid AND gpc.is_primary = true
     LIMIT 1) as primary_county_geoid,
    p.geoid as primary_place_geoid,
    jsonb_build_array(SUBSTRING(p.geoid, 1, 2)) as all_states,
    (SELECT jsonb_agg(county_geoid)
     FROM geo_place_county gpc
     WHERE gpc.place_geoid = p.geoid) as all_counties,
    jsonb_build_array(p.geoid) as all_places,
    ARRAY['US', 
          SUBSTRING(p.geoid, 1, 2),
          COALESCE((SELECT county_geoid 
                    FROM geo_place_county gpc
                    WHERE gpc.place_geoid = p.geoid AND gpc.is_primary = true
                    LIMIT 1), ''),
          p.geoid] as hierarchy_path,
    ST_Area(ST_Transform(p.geometry, 3857)) / 1000000 as area_sqkm
FROM tiger_places p
ON CONFLICT (geoid) DO UPDATE SET
    name = EXCLUDED.name,
    primary_state_geoid = EXCLUDED.primary_state_geoid,
    primary_county_geoid = EXCLUDED.primary_county_geoid,
    primary_place_geoid = EXCLUDED.primary_place_geoid,
    all_states = EXCLUDED.all_states,
    all_counties = EXCLUDED.all_counties,
    all_places = EXCLUDED.all_places,
    hierarchy_path = EXCLUDED.hierarchy_path,
    area_sqkm = EXCLUDED.area_sqkm,
    updated_at = NOW();

-- ============================================================================
-- STEP 6: Populate ZIP Codes (Most Complex)
-- ============================================================================

INSERT INTO geo_hierarchy (geoid, geo_type, name, 
                          primary_state_geoid, primary_county_geoid, primary_place_geoid, primary_cbsa_geoid,
                          all_states, all_counties, all_places, all_cbsas, hierarchy_path, area_sqkm)
SELECT 
    z.geoid,
    'zip' as geo_type,
    z.geoid as name,  -- ZIP code is its own name
    -- Get primary state (from primary county)
    (SELECT state_geoid
     FROM geo_zip_county gzc
     JOIN geo_county_state gcs ON gzc.county_geoid = gcs.county_geoid
     WHERE gzc.zip_geoid = z.geoid AND gzc.is_primary = true
     LIMIT 1) as primary_state_geoid,
    -- Get primary county
    (SELECT county_geoid
     FROM geo_zip_county gzc
     WHERE gzc.zip_geoid = z.geoid AND gzc.is_primary = true
     LIMIT 1) as primary_county_geoid,
    -- Get primary place
    (SELECT place_geoid
     FROM geo_zip_place gzp
     WHERE gzp.zip_geoid = z.geoid AND gzp.is_primary = true
     LIMIT 1) as primary_place_geoid,
    -- Get primary CBSA
    (SELECT cbsa_geoid
     FROM geo_zip_cbsa gzc
     WHERE gzc.zip_geoid = z.geoid AND gzc.is_primary = true
     LIMIT 1) as primary_cbsa_geoid,
    -- Get all states
    (SELECT jsonb_agg(DISTINCT state_geoid)
     FROM geo_zip_county gzc
     JOIN geo_county_state gcs ON gzc.county_geoid = gcs.county_geoid
     WHERE gzc.zip_geoid = z.geoid) as all_states,
    -- Get all counties
    (SELECT jsonb_agg(county_geoid)
     FROM geo_zip_county gzc
     WHERE gzc.zip_geoid = z.geoid) as all_counties,
    -- Get all places
    (SELECT jsonb_agg(place_geoid)
     FROM geo_zip_place gzp
     WHERE gzp.zip_geoid = z.geoid) as all_places,
    -- Get all CBSAs
    (SELECT jsonb_agg(cbsa_geoid)
     FROM geo_zip_cbsa gzc
     WHERE gzc.zip_geoid = z.geoid) as all_cbsas,
    -- Build hierarchy path
    ARRAY['US',
          COALESCE((SELECT state_geoid
                    FROM geo_zip_county gzc
                    JOIN geo_county_state gcs ON gzc.county_geoid = gcs.county_geoid
                    WHERE gzc.zip_geoid = z.geoid AND gzc.is_primary = true
                    LIMIT 1), ''),
          COALESCE((SELECT cbsa_geoid
                    FROM geo_zip_cbsa gzc
                    WHERE gzc.zip_geoid = z.geoid AND gzc.is_primary = true
                    LIMIT 1), ''),
          COALESCE((SELECT place_geoid
                    FROM geo_zip_place gzp
                    WHERE gzp.zip_geoid = z.geoid AND gzp.is_primary = true
                    LIMIT 1), ''),
          z.geoid] as hierarchy_path,
    ST_Area(ST_Transform(z.geometry, 3857)) / 1000000 as area_sqkm
FROM tiger_zcta z
ON CONFLICT (geoid) DO UPDATE SET
    name = EXCLUDED.name,
    primary_state_geoid = EXCLUDED.primary_state_geoid,
    primary_county_geoid = EXCLUDED.primary_county_geoid,
    primary_place_geoid = EXCLUDED.primary_place_geoid,
    primary_cbsa_geoid = EXCLUDED.primary_cbsa_geoid,
    all_states = EXCLUDED.all_states,
    all_counties = EXCLUDED.all_counties,
    all_places = EXCLUDED.all_places,
    all_cbsas = EXCLUDED.all_cbsas,
    hierarchy_path = EXCLUDED.hierarchy_path,
    area_sqkm = EXCLUDED.area_sqkm,
    updated_at = NOW();

-- ============================================================================
-- STEP 7: Helper View for Easy Hierarchy Queries
-- ============================================================================

CREATE OR REPLACE VIEW geo_hierarchy_full AS
SELECT 
    h.geoid,
    h.geo_type,
    h.name,
    h.primary_state_geoid,
    h.primary_county_geoid,
    h.primary_place_geoid,
    h.primary_cbsa_geoid,
    h.hierarchy_path,
    -- Join to get names
    s.name as state_name,
    c.name as county_name,
    p.name as place_name,
    cbsa.name as cbsa_name,
    -- All relationships
    h.all_states,
    h.all_counties,
    h.all_places,
    h.all_cbsas
FROM geo_hierarchy h
LEFT JOIN tiger_states s ON h.primary_state_geoid = s.geoid
LEFT JOIN tiger_counties c ON h.primary_county_geoid = c.geoid
LEFT JOIN tiger_places p ON h.primary_place_geoid = p.geoid
LEFT JOIN tiger_cbsa cbsa ON h.primary_cbsa_geoid = cbsa.geoid;

-- ============================================================================
-- STEP 8: Validation Queries
-- ============================================================================

-- Check hierarchy completeness
SELECT 
    geo_type,
    COUNT(*) as total,
    COUNT(primary_state_geoid) as with_state,
    COUNT(primary_county_geoid) as with_county,
    COUNT(primary_place_geoid) as with_place,
    COUNT(primary_cbsa_geoid) as with_cbsa
FROM geo_hierarchy
GROUP BY geo_type;

-- Check for ZIPs without complete hierarchy
SELECT COUNT(*) as incomplete_zips
FROM geo_hierarchy
WHERE geo_type = 'zip'
  AND (primary_state_geoid IS NULL OR primary_county_geoid IS NULL);

