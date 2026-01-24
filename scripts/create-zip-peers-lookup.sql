-- Create persistent ZIP peer lookup table
SET statement_timeout = '300000';

-- Drop and recreate
DROP TABLE IF EXISTS zip_peer_lookup;

CREATE TABLE zip_peer_lookup AS
WITH state_regions AS (
  SELECT state_code,
    CASE
      WHEN state_code IN ('CT', 'ME', 'MA', 'NH', 'RI', 'VT', 'NJ', 'NY', 'PA') THEN 'NE'
      WHEN state_code IN ('IL', 'IN', 'IA', 'KS', 'MI', 'MN', 'MO', 'NE', 'ND', 'OH', 'SD', 'WI') THEN 'MW'
      WHEN state_code IN ('AL', 'AR', 'DE', 'DC', 'FL', 'GA', 'KY', 'LA', 'MD', 'MS', 'NC', 'OK', 'SC', 'TN', 'TX', 'VA', 'WV') THEN 'SO'
      ELSE 'WE'
    END as region
  FROM (SELECT DISTINCT state_code FROM zillow_state WHERE state_code IS NOT NULL) s
),
zip_latest AS (
  SELECT DISTINCT ON (region_name)
    region_name,
    state_code,
    value as current_zhvi
  FROM zillow_zip
  WHERE metric_name = 'zhvi' AND period_date >= '2024-01-01'
  ORDER BY region_name, period_date DESC
),
zip_prev AS (
  SELECT DISTINCT ON (region_name)
    region_name,
    value as prev_zhvi
  FROM zillow_zip
  WHERE metric_name = 'zhvi' AND period_date >= '2023-01-01' AND period_date < '2024-01-01'
  ORDER BY region_name, period_date DESC
)
SELECT
  zl.region_name,
  CASE
    WHEN zl.current_zhvi < 150000 THEN '1'
    WHEN zl.current_zhvi < 300000 THEN '2'
    WHEN zl.current_zhvi < 500000 THEN '3'
    WHEN zl.current_zhvi < 1000000 THEN '4'
    ELSE '5'
  END || '-' || COALESCE(sr.region, 'WE') || '-' ||
  CASE
    WHEN zp.prev_zhvi IS NULL THEN 'S'
    WHEN ((zl.current_zhvi - zp.prev_zhvi) / NULLIF(zp.prev_zhvi, 0)) < -0.02 THEN 'D'
    WHEN ((zl.current_zhvi - zp.prev_zhvi) / NULLIF(zp.prev_zhvi, 0)) > 0.05 THEN 'G'
    ELSE 'S'
  END as peer_group_id
FROM zip_latest zl
LEFT JOIN zip_prev zp ON zp.region_name = zl.region_name
LEFT JOIN state_regions sr ON sr.state_code = zl.state_code;

CREATE INDEX idx_zip_peer_lookup ON zip_peer_lookup(region_name);

SELECT 'Lookup table created' as status, COUNT(*) as zips, COUNT(DISTINCT peer_group_id) as groups
FROM zip_peer_lookup;
