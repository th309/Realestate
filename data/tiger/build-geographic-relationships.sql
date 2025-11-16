-- Build Geographic Relationships from TIGER Shapefiles
-- This script creates junction tables and calculates spatial relationships

-- ============================================================================
-- STEP 1: Create Junction Tables
-- ============================================================================

-- ZIP to County relationships
CREATE TABLE IF NOT EXISTS geo_zip_county (
    zip_geoid VARCHAR(5) NOT NULL,
    county_geoid VARCHAR(5) NOT NULL,
    overlap_percentage DECIMAL(5,2) NOT NULL,
    overlap_area_sqkm DECIMAL(12,4),
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (zip_geoid, county_geoid),
    FOREIGN KEY (zip_geoid) REFERENCES tiger_zcta(geoid),
    FOREIGN KEY (county_geoid) REFERENCES tiger_counties(geoid)
);

CREATE INDEX idx_zip_county_zip ON geo_zip_county(zip_geoid);
CREATE INDEX idx_zip_county_county ON geo_zip_county(county_geoid);
CREATE INDEX idx_zip_county_primary ON geo_zip_county(zip_geoid, is_primary) WHERE is_primary = true;

-- ZIP to Place relationships
CREATE TABLE IF NOT EXISTS geo_zip_place (
    zip_geoid VARCHAR(5) NOT NULL,
    place_geoid VARCHAR(7) NOT NULL,
    overlap_percentage DECIMAL(5,2) NOT NULL,
    overlap_area_sqkm DECIMAL(12,4),
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (zip_geoid, place_geoid),
    FOREIGN KEY (zip_geoid) REFERENCES tiger_zcta(geoid),
    FOREIGN KEY (place_geoid) REFERENCES tiger_places(geoid)
);

CREATE INDEX idx_zip_place_zip ON geo_zip_place(zip_geoid);
CREATE INDEX idx_zip_place_place ON geo_zip_place(place_geoid);
CREATE INDEX idx_zip_place_primary ON geo_zip_place(zip_geoid, is_primary) WHERE is_primary = true;

-- ZIP to CBSA relationships
CREATE TABLE IF NOT EXISTS geo_zip_cbsa (
    zip_geoid VARCHAR(5) NOT NULL,
    cbsa_geoid VARCHAR(5) NOT NULL,
    overlap_percentage DECIMAL(5,2) NOT NULL,
    overlap_area_sqkm DECIMAL(12,4),
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (zip_geoid, cbsa_geoid),
    FOREIGN KEY (zip_geoid) REFERENCES tiger_zcta(geoid),
    FOREIGN KEY (cbsa_geoid) REFERENCES tiger_cbsa(geoid)
);

CREATE INDEX idx_zip_cbsa_zip ON geo_zip_cbsa(zip_geoid);
CREATE INDEX idx_zip_cbsa_cbsa ON geo_zip_cbsa(cbsa_geoid);
CREATE INDEX idx_zip_cbsa_primary ON geo_zip_cbsa(zip_geoid, is_primary) WHERE is_primary = true;

-- Place to County relationships
CREATE TABLE IF NOT EXISTS geo_place_county (
    place_geoid VARCHAR(7) NOT NULL,
    county_geoid VARCHAR(5) NOT NULL,
    overlap_percentage DECIMAL(5,2) NOT NULL,
    overlap_area_sqkm DECIMAL(12,4),
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (place_geoid, county_geoid),
    FOREIGN KEY (place_geoid) REFERENCES tiger_places(geoid),
    FOREIGN KEY (county_geoid) REFERENCES tiger_counties(geoid)
);

CREATE INDEX idx_place_county_place ON geo_place_county(place_geoid);
CREATE INDEX idx_place_county_county ON geo_place_county(county_geoid);

-- County to CBSA relationships
CREATE TABLE IF NOT EXISTS geo_county_cbsa (
    county_geoid VARCHAR(5) NOT NULL,
    cbsa_geoid VARCHAR(5) NOT NULL,
    overlap_percentage DECIMAL(5,2) NOT NULL,
    overlap_area_sqkm DECIMAL(12,4),
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (county_geoid, cbsa_geoid),
    FOREIGN KEY (county_geoid) REFERENCES tiger_counties(geoid),
    FOREIGN KEY (cbsa_geoid) REFERENCES tiger_cbsa(geoid)
);

CREATE INDEX idx_county_cbsa_county ON geo_county_cbsa(county_geoid);
CREATE INDEX idx_county_cbsa_cbsa ON geo_county_cbsa(cbsa_geoid);

-- County to State (one-to-many, but stored for consistency)
CREATE TABLE IF NOT EXISTS geo_county_state (
    county_geoid VARCHAR(5) NOT NULL,
    state_geoid VARCHAR(2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (county_geoid, state_geoid),
    FOREIGN KEY (county_geoid) REFERENCES tiger_counties(geoid),
    FOREIGN KEY (state_geoid) REFERENCES tiger_states(geoid)
);

-- ============================================================================
-- STEP 2: Helper Function to Calculate Overlap
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_overlap_percentage(
    geom1 GEOMETRY,
    geom2 GEOMETRY
) RETURNS DECIMAL AS $$
DECLARE
    intersection_area DECIMAL;
    geom1_area DECIMAL;
    percentage DECIMAL;
BEGIN
    -- Check if geometries intersect
    IF NOT ST_Intersects(geom1, geom2) THEN
        RETURN 0;
    END IF;
    
    -- Calculate intersection area in square kilometers
    intersection_area := ST_Area(
        ST_Transform(ST_Intersection(geom1, geom2), 3857)
    ) / 1000000;  -- Convert from square meters to square kilometers
    
    -- Calculate area of first geometry
    geom1_area := ST_Area(
        ST_Transform(geom1, 3857)
    ) / 1000000;
    
    -- Avoid division by zero
    IF geom1_area = 0 THEN
        RETURN 0;
    END IF;
    
    -- Calculate percentage
    percentage := (intersection_area / geom1_area) * 100;
    
    RETURN ROUND(percentage, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- STEP 3: Populate ZIP to County Relationships
-- ============================================================================

-- This will take a while - process in batches
INSERT INTO geo_zip_county (zip_geoid, county_geoid, overlap_percentage, overlap_area_sqkm, is_primary)
SELECT 
    z.geoid as zip_geoid,
    c.geoid as county_geoid,
    calculate_overlap_percentage(z.geometry, c.geometry) as overlap_percentage,
    ST_Area(ST_Transform(ST_Intersection(z.geometry, c.geometry), 3857)) / 1000000 as overlap_area_sqkm,
    CASE 
        WHEN calculate_overlap_percentage(z.geometry, c.geometry) > 50 THEN true
        ELSE false
    END as is_primary
FROM tiger_zcta z
CROSS JOIN tiger_counties c
WHERE ST_Intersects(z.geometry, c.geometry)
  AND ST_Area(ST_Intersection(z.geometry, c.geometry)) > 0
ON CONFLICT (zip_geoid, county_geoid) DO UPDATE SET
    overlap_percentage = EXCLUDED.overlap_percentage,
    overlap_area_sqkm = EXCLUDED.overlap_area_sqkm,
    is_primary = EXCLUDED.is_primary;

-- ============================================================================
-- STEP 4: Populate ZIP to Place Relationships
-- ============================================================================

INSERT INTO geo_zip_place (zip_geoid, place_geoid, overlap_percentage, overlap_area_sqkm, is_primary)
SELECT 
    z.geoid as zip_geoid,
    p.geoid as place_geoid,
    calculate_overlap_percentage(z.geometry, p.geometry) as overlap_percentage,
    ST_Area(ST_Transform(ST_Intersection(z.geometry, p.geometry), 3857)) / 1000000 as overlap_area_sqkm,
    CASE 
        WHEN calculate_overlap_percentage(z.geometry, p.geometry) > 50 THEN true
        ELSE false
    END as is_primary
FROM tiger_zcta z
CROSS JOIN tiger_places p
WHERE ST_Intersects(z.geometry, p.geometry)
  AND ST_Area(ST_Intersection(z.geometry, p.geometry)) > 0
ON CONFLICT (zip_geoid, place_geoid) DO UPDATE SET
    overlap_percentage = EXCLUDED.overlap_percentage,
    overlap_area_sqkm = EXCLUDED.overlap_area_sqkm,
    is_primary = EXCLUDED.is_primary;

-- ============================================================================
-- STEP 5: Populate ZIP to CBSA Relationships
-- ============================================================================

INSERT INTO geo_zip_cbsa (zip_geoid, cbsa_geoid, overlap_percentage, overlap_area_sqkm, is_primary)
SELECT 
    z.geoid as zip_geoid,
    cbsa.geoid as cbsa_geoid,
    calculate_overlap_percentage(z.geometry, cbsa.geometry) as overlap_percentage,
    ST_Area(ST_Transform(ST_Intersection(z.geometry, cbsa.geometry), 3857)) / 1000000 as overlap_area_sqkm,
    CASE 
        WHEN calculate_overlap_percentage(z.geometry, cbsa.geometry) > 50 THEN true
        ELSE false
    END as is_primary
FROM tiger_zcta z
CROSS JOIN tiger_cbsa cbsa
WHERE ST_Intersects(z.geometry, cbsa.geometry)
  AND ST_Area(ST_Intersection(z.geometry, cbsa.geometry)) > 0
ON CONFLICT (zip_geoid, cbsa_geoid) DO UPDATE SET
    overlap_percentage = EXCLUDED.overlap_percentage,
    overlap_area_sqkm = EXCLUDED.overlap_area_sqkm,
    is_primary = EXCLUDED.is_primary;

-- ============================================================================
-- STEP 6: Populate Place to County Relationships
-- ============================================================================

INSERT INTO geo_place_county (place_geoid, county_geoid, overlap_percentage, overlap_area_sqkm, is_primary)
SELECT 
    p.geoid as place_geoid,
    c.geoid as county_geoid,
    calculate_overlap_percentage(p.geometry, c.geometry) as overlap_percentage,
    ST_Area(ST_Transform(ST_Intersection(p.geometry, c.geometry), 3857)) / 1000000 as overlap_area_sqkm,
    CASE 
        WHEN calculate_overlap_percentage(p.geometry, c.geometry) > 50 THEN true
        ELSE false
    END as is_primary
FROM tiger_places p
CROSS JOIN tiger_counties c
WHERE ST_Intersects(p.geometry, c.geometry)
  AND ST_Area(ST_Intersection(p.geometry, c.geometry)) > 0
ON CONFLICT (place_geoid, county_geoid) DO UPDATE SET
    overlap_percentage = EXCLUDED.overlap_percentage,
    overlap_area_sqkm = EXCLUDED.overlap_area_sqkm,
    is_primary = EXCLUDED.is_primary;

-- ============================================================================
-- STEP 7: Populate County to CBSA Relationships
-- ============================================================================

INSERT INTO geo_county_cbsa (county_geoid, cbsa_geoid, overlap_percentage, overlap_area_sqkm, is_primary)
SELECT 
    c.geoid as county_geoid,
    cbsa.geoid as cbsa_geoid,
    calculate_overlap_percentage(c.geometry, cbsa.geometry) as overlap_percentage,
    ST_Area(ST_Transform(ST_Intersection(c.geometry, cbsa.geometry), 3857)) / 1000000 as overlap_area_sqkm,
    CASE 
        WHEN calculate_overlap_percentage(c.geometry, cbsa.geometry) > 50 THEN true
        ELSE false
    END as is_primary
FROM tiger_counties c
CROSS JOIN tiger_cbsa cbsa
WHERE ST_Intersects(c.geometry, cbsa.geometry)
  AND ST_Area(ST_Intersection(c.geometry, cbsa.geometry)) > 0
ON CONFLICT (county_geoid, cbsa_geoid) DO UPDATE SET
    overlap_percentage = EXCLUDED.overlap_percentage,
    overlap_area_sqkm = EXCLUDED.overlap_area_sqkm,
    is_primary = EXCLUDED.is_primary;

-- ============================================================================
-- STEP 8: Populate County to State Relationships
-- ============================================================================

INSERT INTO geo_county_state (county_geoid, state_geoid)
SELECT DISTINCT
    c.geoid as county_geoid,
    SUBSTRING(c.geoid, 1, 2) as state_geoid
FROM tiger_counties c
ON CONFLICT (county_geoid, state_geoid) DO NOTHING;

-- ============================================================================
-- STEP 9: Validation Queries
-- ============================================================================

-- Check for ZIPs without county relationships
SELECT COUNT(*) as zips_without_county
FROM tiger_zcta z
LEFT JOIN geo_zip_county gzc ON z.geoid = gzc.zip_geoid
WHERE gzc.zip_geoid IS NULL;

-- Check for ZIPs with multiple primary counties (shouldn't happen)
SELECT zip_geoid, COUNT(*) as primary_count
FROM geo_zip_county
WHERE is_primary = true
GROUP BY zip_geoid
HAVING COUNT(*) > 1;

-- Check overlap percentages sum to ~100% for each ZIP
SELECT 
    zip_geoid,
    SUM(overlap_percentage) as total_overlap
FROM geo_zip_county
GROUP BY zip_geoid
HAVING SUM(overlap_percentage) < 95 OR SUM(overlap_percentage) > 105;

