-- Migration 037: Create zillow_zip table and migrate data from zillow_zhvi
-- This creates a dedicated table for ZIP-level Zillow data matching the pattern of other zillow_* tables

-- Create the zillow_zip table
CREATE TABLE IF NOT EXISTS zillow_zip (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_id INTEGER NOT NULL,
    region_name VARCHAR(10) NOT NULL,  -- ZIP code as string
    state_code VARCHAR(2),
    county_fips VARCHAR(5),
    period_date DATE NOT NULL,
    metric_name VARCHAR(50) NOT NULL,
    value DECIMAL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Create composite unique constraint
    CONSTRAINT zillow_zip_unique UNIQUE (region_id, period_date, metric_name)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_zillow_zip_region_id ON zillow_zip(region_id);
CREATE INDEX IF NOT EXISTS idx_zillow_zip_state_code ON zillow_zip(state_code);
CREATE INDEX IF NOT EXISTS idx_zillow_zip_period_date ON zillow_zip(period_date);
CREATE INDEX IF NOT EXISTS idx_zillow_zip_metric_name ON zillow_zip(metric_name);
CREATE INDEX IF NOT EXISTS idx_zillow_zip_region_metric_date ON zillow_zip(region_id, metric_name, period_date DESC);

-- Migrate ZHVI data from zillow_zhvi where geography='Zip'
-- Join with geography_crosswalk to get state_code and county_fips
INSERT INTO zillow_zip (region_id, region_name, state_code, county_fips, period_date, metric_name, value, updated_at)
SELECT DISTINCT ON (z.region_id::INTEGER, z.date)
    z.region_id::INTEGER as region_id,
    z.region_id as region_name,  -- ZIP code is the region_id
    gc.state_abbrev as state_code,
    gc.county_fips as county_fips,
    z.date as period_date,
    'zhvi' as metric_name,
    z.value,
    NOW() as updated_at
FROM zillow_zhvi z
LEFT JOIN geography_crosswalk gc ON gc.zip_code = z.region_id
WHERE z.geography = 'Zip'
  AND z.property_type = 'sfrcondo'
  AND z.tier = '0.33_0.67'
ON CONFLICT (region_id, period_date, metric_name) DO UPDATE SET
    value = EXCLUDED.value,
    state_code = EXCLUDED.state_code,
    county_fips = EXCLUDED.county_fips,
    updated_at = NOW();

-- Grant permissions
GRANT SELECT ON zillow_zip TO authenticated;
GRANT SELECT ON zillow_zip TO anon;

-- Add comment
COMMENT ON TABLE zillow_zip IS 'ZIP-level Zillow home value data. region_name is the ZIP code.';
