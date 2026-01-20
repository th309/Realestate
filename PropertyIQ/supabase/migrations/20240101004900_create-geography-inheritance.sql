-- Migration: Create Geography Inheritance Table
-- Description: Maps each geography to its parent for metric inheritance
-- Date: 2026-01-20

-- Geography Inheritance Lookup Table
-- Used to inherit metrics from parent geographies when data is unavailable
CREATE TABLE IF NOT EXISTS geography_inheritance (
  geography_id TEXT PRIMARY KEY,
  geography_type TEXT NOT NULL,  -- 'zip', 'city', 'county', 'metro', 'state', 'national'

  -- Direct identifiers
  zip_code TEXT,
  city_place_fips TEXT,
  county_fips TEXT,
  metro_cbsa TEXT,
  state_fips TEXT,

  -- Parent geography IDs for inheritance chain
  parent_county_fips TEXT,
  parent_metro_cbsa TEXT,
  parent_state_fips TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_geography_type CHECK (geography_type IN ('zip', 'city', 'county', 'metro', 'state', 'national'))
);

-- Indexes for fast inheritance lookups
CREATE INDEX IF NOT EXISTS idx_geo_inheritance_zip ON geography_inheritance(zip_code) WHERE zip_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_geo_inheritance_county ON geography_inheritance(county_fips) WHERE county_fips IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_geo_inheritance_metro ON geography_inheritance(metro_cbsa) WHERE metro_cbsa IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_geo_inheritance_state ON geography_inheritance(state_fips) WHERE state_fips IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_geo_inheritance_type ON geography_inheritance(geography_type);
CREATE INDEX IF NOT EXISTS idx_geo_inheritance_parent_county ON geography_inheritance(parent_county_fips) WHERE parent_county_fips IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_geo_inheritance_parent_metro ON geography_inheritance(parent_metro_cbsa) WHERE parent_metro_cbsa IS NOT NULL;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON geography_inheritance TO authenticated;
GRANT SELECT ON geography_inheritance TO anon;

COMMENT ON TABLE geography_inheritance IS 'Maps geographies to their parent geographies for metric inheritance. Used when data is unavailable at granular levels.';

-- Function to get metric value with inheritance
-- Returns the metric value and its source geography
CREATE OR REPLACE FUNCTION get_metric_with_inheritance(
  p_geography_id TEXT,
  p_metric_column TEXT,
  p_table_name TEXT,
  p_period_date DATE
) RETURNS TABLE (
  metric_value NUMERIC,
  source_geography_id TEXT,
  source_geography_type TEXT,
  is_inherited BOOLEAN
) AS $$
DECLARE
  v_geo_type TEXT;
  v_county_fips TEXT;
  v_metro_cbsa TEXT;
  v_state_fips TEXT;
  v_value NUMERIC;
  v_sql TEXT;
BEGIN
  -- Get the geography inheritance chain
  SELECT
    geography_type,
    parent_county_fips,
    parent_metro_cbsa,
    parent_state_fips
  INTO v_geo_type, v_county_fips, v_metro_cbsa, v_state_fips
  FROM geography_inheritance
  WHERE geography_id = p_geography_id;

  -- If geography not found, return NULL
  IF v_geo_type IS NULL THEN
    RETURN QUERY SELECT NULL::NUMERIC, NULL::TEXT, NULL::TEXT, FALSE;
    RETURN;
  END IF;

  -- Try direct lookup first (dynamic SQL for different tables)
  v_sql := format('SELECT %I FROM %I WHERE geography_id = $1 AND period_date = $2', p_metric_column, p_table_name);
  EXECUTE v_sql INTO v_value USING p_geography_id, p_period_date;

  IF v_value IS NOT NULL THEN
    RETURN QUERY SELECT v_value, p_geography_id, v_geo_type, FALSE;
    RETURN;
  END IF;

  -- Try county inheritance (for ZIP/City)
  IF v_county_fips IS NOT NULL THEN
    EXECUTE v_sql INTO v_value USING v_county_fips, p_period_date;
    IF v_value IS NOT NULL THEN
      RETURN QUERY SELECT v_value, v_county_fips, 'county'::TEXT, TRUE;
      RETURN;
    END IF;
  END IF;

  -- Try metro inheritance
  IF v_metro_cbsa IS NOT NULL THEN
    EXECUTE v_sql INTO v_value USING v_metro_cbsa, p_period_date;
    IF v_value IS NOT NULL THEN
      RETURN QUERY SELECT v_value, v_metro_cbsa, 'metro'::TEXT, TRUE;
      RETURN;
    END IF;
  END IF;

  -- Try state inheritance
  IF v_state_fips IS NOT NULL THEN
    EXECUTE v_sql INTO v_value USING v_state_fips, p_period_date;
    IF v_value IS NOT NULL THEN
      RETURN QUERY SELECT v_value, v_state_fips, 'state'::TEXT, TRUE;
      RETURN;
    END IF;
  END IF;

  -- Try national fallback
  EXECUTE v_sql INTO v_value USING 'national', p_period_date;
  IF v_value IS NOT NULL THEN
    RETURN QUERY SELECT v_value, 'national'::TEXT, 'national'::TEXT, TRUE;
    RETURN;
  END IF;

  -- No data found at any level
  RETURN QUERY SELECT NULL::NUMERIC, NULL::TEXT, NULL::TEXT, FALSE;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_metric_with_inheritance IS 'Returns metric value with inheritance. Tries direct lookup, then falls back through county → metro → state → national chain.';
