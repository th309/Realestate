-- Migration 046: Create tiger_national table and GeoJSON RPC function
-- Source: Census Cartographic Boundary File cb_2024_us_nation_5m.shp
-- Download: https://www2.census.gov/geo/tiger/GENZ2024/shp/cb_2024_us_nation_5m.zip

BEGIN;

-- ============================================================================
-- 1. CREATE TIGER NATIONAL TABLE
-- ============================================================================

DROP TABLE IF EXISTS tiger_national CASCADE;

CREATE TABLE tiger_national (
    ogc_fid SERIAL PRIMARY KEY,
    geoid VARCHAR(2) UNIQUE NOT NULL,
    name VARCHAR(100),
    affgeoid VARCHAR(11),
    geometry GEOMETRY(MULTIPOLYGON, 4326)
);

-- Create spatial index
CREATE INDEX idx_tiger_national_geometry ON tiger_national USING GIST (geometry);

-- Enable RLS
ALTER TABLE tiger_national ENABLE ROW LEVEL SECURITY;

-- Create read policy
CREATE POLICY "Allow public read access" ON tiger_national FOR SELECT TO PUBLIC USING (true);

-- Grant permissions
GRANT SELECT ON tiger_national TO anon, authenticated, service_role;
GRANT ALL ON tiger_national TO service_role;
GRANT USAGE, SELECT ON SEQUENCE tiger_national_ogc_fid_seq TO service_role;

-- ============================================================================
-- 2. CREATE GEOJSON RPC FUNCTION
-- ============================================================================

-- Function to get national boundary as GeoJSON FeatureCollection
CREATE OR REPLACE FUNCTION get_national_geojson()
RETURNS JSON
LANGUAGE SQL
STABLE
AS $$
SELECT json_build_object(
  'type', 'FeatureCollection',
  'features', COALESCE(
    json_agg(
      json_build_object(
        'type', 'Feature',
        'geometry', ST_AsGeoJSON(geometry)::json,
        'properties', json_build_object(
          'GEOID', geoid,
          'NAME', name,
          'AFFGEOID', affgeoid
        )
      )
    ),
    '[]'::json
  )
)
FROM tiger_national
WHERE geometry IS NOT NULL;
$$;

-- ============================================================================
-- 3. GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_national_geojson() TO anon, authenticated, service_role;

-- ============================================================================
-- 4. ADD DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE tiger_national IS 'US national boundary from Census Cartographic Boundary Files (cb_2024_us_nation_5m)';
COMMENT ON FUNCTION get_national_geojson() IS 'Returns US national boundary as GeoJSON FeatureCollection for map display';

COMMIT;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 046 completed: Created tiger_national table and get_national_geojson() RPC function';
END $$;
