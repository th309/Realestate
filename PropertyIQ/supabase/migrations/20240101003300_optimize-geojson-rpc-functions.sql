-- Migration 037: Optimize RPC functions for GeoJSON endpoints
-- Uses ST_Simplify to reduce geometry complexity for national views
-- Fixes timeout issues on large datasets

-- Counties national view with aggressive simplification (0.05 tolerance)
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
        'geometry', ST_AsGeoJSON(ST_Simplify(geometry, 0.05))::json,
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

-- States GeoJSON
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
        'geometry', ST_AsGeoJSON(ST_Simplify(geometry, 0.01))::json,
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

-- Metros with aggressive simplification (0.05 tolerance)
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
        'geometry', ST_AsGeoJSON(ST_Simplify(geometry, 0.05))::json,
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

-- Counties by state (full detail)
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
        'geometry', ST_AsGeoJSON(geometry)::json,
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

-- ZCTA by state with simplification to help with timeout
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
        'geometry', ST_AsGeoJSON(ST_Simplify(geometry, 0.005))::json,
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

-- Places by state
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
        'geometry', ST_AsGeoJSON(ST_Simplify(geometry, 0.001))::json,
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_states_geojson() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_counties_geojson() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_counties_geojson_by_state(VARCHAR) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_metros_geojson() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_zcta_geojson_by_state(VARCHAR) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_places_geojson_by_state(VARCHAR) TO authenticated, anon, service_role;
