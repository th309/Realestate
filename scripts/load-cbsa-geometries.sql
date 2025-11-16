-- Load CBSA geometries into dim_geography_geometry
-- Run this in Supabase SQL Editor
-- Note: This requires the GeoJSON data to be accessible
-- Alternative: Use the API endpoint /api/load-cbsa-geometries-direct

-- First, verify the table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'dim_geography_geometry' 
AND table_schema = 'public';

-- Check if geom column exists, if not create it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'dim_geography_geometry' 
        AND column_name = 'geom'
    ) THEN
        ALTER TABLE dim_geography_geometry 
        ADD COLUMN geom GEOMETRY(MultiPolygon, 4326);
        
        CREATE INDEX IF NOT EXISTS idx_dim_geography_geometry_geom 
        ON dim_geography_geometry USING GIST(geom);
    END IF;
END $$;

-- Verify CBSA entries exist
SELECT COUNT(*) as cbsa_count 
FROM dim_geography 
WHERE level = 'cbsa';

-- Note: To actually load geometries, you need to either:
-- 1. Use the API endpoint: POST /api/load-cbsa-geometries-direct
-- 2. Use QGIS/pgAdmin to import the shapefile
-- 3. Use a script that can read the GeoJSON file and insert geometries








