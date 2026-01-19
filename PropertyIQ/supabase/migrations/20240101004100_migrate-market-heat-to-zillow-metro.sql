-- Migration: Import Market Heat Index data into zillow_metro table
-- Purpose: Move market heat data from legacy zillow_market_heat_index to new zillow_metro schema
-- Date: 2025-01-15

-- Insert market heat data into zillow_metro with metric_name='market_heat'
INSERT INTO zillow_metro (
  region_id,
  region_name,
  cbsa_code,
  state_code,
  period_date,
  metric_name,
  value
)
SELECT
  mh.region_id::INTEGER,
  COALESCE(m.region_name, 'Unknown'),
  m.cbsa_code,
  m.state_code,
  mh.date,
  'market_heat' as metric_name,
  mh.heat_index as value
FROM zillow_market_heat_index mh
LEFT JOIN markets m ON mh.region_id = m.region_id
WHERE mh.heat_index IS NOT NULL
  AND mh.geography = 'Metro'
ON CONFLICT (region_id, period_date, metric_name)
DO UPDATE SET value = EXCLUDED.value;

-- Log the migration results
DO $$
DECLARE
  row_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO row_count
  FROM zillow_metro
  WHERE metric_name = 'market_heat';

  RAISE NOTICE 'Migrated % market_heat records to zillow_metro', row_count;
END $$;
