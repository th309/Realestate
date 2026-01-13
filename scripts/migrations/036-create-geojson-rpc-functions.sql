-- Migration 035: Create RPC functions to serve GeoJSON from tiger_* tables
-- These functions return GeoJSON FeatureCollections for map display

-- Function to get all states as GeoJSON FeatureCollection
CREATE OR REPLACE FUNCTION get_states_geojson()
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
        'geometry', geometry,
        'properties', json_build_object(
          'name', name,
          'STATEFP', geoid,
          'STUSPS', state_abbreviation,
          'population', population
        )
      )
    ),
    '[]'::json
  )
)
FROM tiger_states
WHERE geometry IS NOT NULL;
$$;

-- Function to get all counties as GeoJSON FeatureCollection
CREATE OR REPLACE FUNCTION get_counties_geojson()
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
        'id', geoid,
        'geometry', geometry,
        'properties', json_build_object(
          'id', geoid,
          'NAME', name,
          'STATEFP', state_fips,
          'COUNTYFP', SUBSTRING(geoid, 3, 3),
          'population', population
        )
      )
    ),
    '[]'::json
  )
)
FROM tiger_counties
WHERE geometry IS NOT NULL;
$$;

-- Function to get all metros (CBSAs) as GeoJSON FeatureCollection
CREATE OR REPLACE FUNCTION get_metros_geojson()
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
        'geometry', geometry,
        'properties', json_build_object(
          'CBSAFP', geoid,
          'GEOID', geoid,
          'NAME', name,
          'NAMELSAD', name || ' ' || CASE WHEN lsad = 'M1' THEN 'Metro Area' ELSE 'Micro Area' END,
          'LSAD', lsad,
          'population', population
        )
      )
    ),
    '[]'::json
  )
)
FROM tiger_cbsa
WHERE geometry IS NOT NULL;
$$;

-- Function to get ZCTAs by state as GeoJSON FeatureCollection
CREATE OR REPLACE FUNCTION get_zcta_geojson_by_state(p_state_abbrev VARCHAR(2))
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
        'geometry', geometry,
        'properties', json_build_object(
          'ZCTA5CE20', geoid,
          'GEOID20', geoid,
          'population', population
        )
      )
    ),
    '[]'::json
  )
)
FROM tiger_zcta
WHERE geometry IS NOT NULL
  AND UPPER(default_state) = UPPER(p_state_abbrev);
$$;

-- Function to get places (cities) by state as GeoJSON FeatureCollection
-- Uses SUBSTRING(geoid, 1, 2) to extract state FIPS since state_fips column may be NULL
CREATE OR REPLACE FUNCTION get_places_geojson_by_state(p_state_abbrev VARCHAR(2))
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
        'geometry', geometry,
        'properties', json_build_object(
          'GEOID', geoid,
          'NAME', name,
          'NAMELSAD', name,
          'STATEFP', SUBSTRING(geoid, 1, 2),
          'PLACEFP', SUBSTRING(geoid, 3)
        )
      )
    ),
    '[]'::json
  )
)
FROM tiger_places
WHERE geometry IS NOT NULL
  AND SUBSTRING(geoid, 1, 2) = (
    SELECT geoid FROM tiger_states WHERE UPPER(state_abbreviation) = UPPER(p_state_abbrev)
  );
$$;

-- Function to get counties by state as GeoJSON FeatureCollection
CREATE OR REPLACE FUNCTION get_counties_geojson_by_state(p_state_abbrev VARCHAR(2))
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
        'id', geoid,
        'geometry', geometry,
        'properties', json_build_object(
          'id', geoid,
          'NAME', name,
          'STATEFP', state_fips,
          'COUNTYFP', SUBSTRING(geoid, 3, 3),
          'population', population
        )
      )
    ),
    '[]'::json
  )
)
FROM tiger_counties
WHERE geometry IS NOT NULL
  AND state_fips = (
    SELECT geoid FROM tiger_states WHERE UPPER(state_abbreviation) = UPPER(p_state_abbrev)
  );
$$;

-- Function to get all ZCTAs as GeoJSON FeatureCollection (for national view)
CREATE OR REPLACE FUNCTION get_all_zcta_geojson()
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
        'geometry', geometry,
        'properties', json_build_object(
          'ZCTA5CE20', geoid,
          'GEOID20', geoid,
          'population', population,
          'state', default_state
        )
      )
    ),
    '[]'::json
  )
)
FROM tiger_zcta
WHERE geometry IS NOT NULL;
$$;

-- Function to get all places as GeoJSON FeatureCollection (for national view)
CREATE OR REPLACE FUNCTION get_all_places_geojson()
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
        'geometry', geometry,
        'properties', json_build_object(
          'GEOID', geoid,
          'NAME', name,
          'NAMELSAD', name,
          'STATEFP', state_fips,
          'PLACEFP', SUBSTRING(geoid, 3)
        )
      )
    ),
    '[]'::json
  )
)
FROM tiger_places
WHERE geometry IS NOT NULL;
$$;

-- Grant execute permissions to authenticated users and anon
GRANT EXECUTE ON FUNCTION get_states_geojson() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_counties_geojson() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_counties_geojson_by_state(VARCHAR) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_metros_geojson() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_zcta_geojson_by_state(VARCHAR) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_places_geojson_by_state(VARCHAR) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_all_zcta_geojson() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_all_places_geojson() TO authenticated, anon;

-- Add comments for documentation
COMMENT ON FUNCTION get_states_geojson() IS 'Returns all US states as GeoJSON FeatureCollection for map display';
COMMENT ON FUNCTION get_counties_geojson() IS 'Returns all US counties as GeoJSON FeatureCollection for map display';
COMMENT ON FUNCTION get_counties_geojson_by_state(VARCHAR) IS 'Returns counties for a specific state as GeoJSON FeatureCollection';
COMMENT ON FUNCTION get_metros_geojson() IS 'Returns all CBSAs (metro areas) as GeoJSON FeatureCollection for map display';
COMMENT ON FUNCTION get_zcta_geojson_by_state(VARCHAR) IS 'Returns ZCTAs (ZIP codes) for a specific state as GeoJSON FeatureCollection';
COMMENT ON FUNCTION get_places_geojson_by_state(VARCHAR) IS 'Returns places (cities) for a specific state as GeoJSON FeatureCollection';
COMMENT ON FUNCTION get_all_zcta_geojson() IS 'Returns all ZCTAs as GeoJSON FeatureCollection (large dataset)';
COMMENT ON FUNCTION get_all_places_geojson() IS 'Returns all places as GeoJSON FeatureCollection (large dataset)';
