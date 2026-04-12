-- ============================================================================
-- ZHVI Forward Returns + PropertyIQ Score History Backfill
-- Migration: 139
--
-- Creates two helper tables and backfills forward-return data on
-- propertyiq_scores_v2 so that the Score Health admin card and the nightly
-- snapshot cron have real ground-truth outcomes to validate scores against.
--
-- Tables created:
--   zhvi_forward_returns   — precomputed t0 / t+12m / t+36m ZHVI and the
--                            resulting return_1y and return_3y_ann for every
--                            (geography_level, location_id, period_date).
--   score_geo_state_map    — maps every (geography, location_id) used in
--                            propertyiq_scores_v2 to its primary state_code,
--                            using the metro crosswalk's largest-population-
--                            share choice for multi-state metros.
--
-- Backfills:
--   propertyiq_scores_v2.return_1y and .return_3y_ann are populated from
--   zhvi_forward_returns for every score_type='propertyiq' row whose
--   score_date has at least 12 (or 36) months of forward ZHVI available.
--   Rows whose forward window is still in the future remain NULL — those are
--   the "pending" validation cohort.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. zhvi_forward_returns
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS zhvi_forward_returns (
  geography_level TEXT NOT NULL,     -- 'state' | 'metro' | 'county' | 'zip'
  location_id     TEXT NOT NULL,     -- state_code | cbsa_code | fips_code | ZIP
  period_date     DATE NOT NULL,     -- t0 (score date, monthly)
  zhvi_t0         NUMERIC NOT NULL,
  zhvi_t12        NUMERIC,           -- ZHVI at t0 + 12 months
  zhvi_t36        NUMERIC,           -- ZHVI at t0 + 36 months
  return_1y       NUMERIC,           -- (t12 - t0) / t0
  return_3y_ann   NUMERIC,           -- (t36 / t0)^(1/3) - 1
  PRIMARY KEY (geography_level, location_id, period_date)
);

CREATE INDEX IF NOT EXISTS idx_zhvi_forward_returns_geo_date
  ON zhvi_forward_returns(geography_level, period_date);

GRANT ALL ON zhvi_forward_returns TO service_role;
GRANT ALL ON zhvi_forward_returns TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. score_geo_state_map
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS score_geo_state_map (
  geography   TEXT NOT NULL,    -- 'county' | 'metro' | 'zip'
  location_id TEXT NOT NULL,
  state_code  TEXT NOT NULL,
  PRIMARY KEY (geography, location_id)
);

GRANT ALL ON score_geo_state_map TO service_role;
GRANT ALL ON score_geo_state_map TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Populate zhvi_forward_returns — STATE
-- ---------------------------------------------------------------------------

INSERT INTO zhvi_forward_returns
  (geography_level, location_id, period_date, zhvi_t0, zhvi_t12, zhvi_t36, return_1y, return_3y_ann)
SELECT
  'state',
  z0.state_code,
  z0.period_date,
  z0.value,
  z12.value,
  z36.value,
  CASE WHEN z12.value IS NOT NULL AND z0.value > 0
       THEN (z12.value - z0.value) / z0.value END,
  CASE WHEN z36.value IS NOT NULL AND z0.value > 0
       THEN POWER(z36.value / z0.value, 1.0/3.0) - 1 END
FROM zillow_state z0
LEFT JOIN zillow_state z12
  ON  z12.state_code = z0.state_code
  AND z12.metric_name = 'zhvi'
  AND date_trunc('month', z12.period_date) = date_trunc('month', z0.period_date + INTERVAL '12 months')
LEFT JOIN zillow_state z36
  ON  z36.state_code = z0.state_code
  AND z36.metric_name = 'zhvi'
  AND date_trunc('month', z36.period_date) = date_trunc('month', z0.period_date + INTERVAL '36 months')
WHERE z0.metric_name = 'zhvi'
  AND z0.state_code IS NOT NULL
ON CONFLICT (geography_level, location_id, period_date) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Populate zhvi_forward_returns — METRO
-- ---------------------------------------------------------------------------

INSERT INTO zhvi_forward_returns
  (geography_level, location_id, period_date, zhvi_t0, zhvi_t12, zhvi_t36, return_1y, return_3y_ann)
SELECT
  'metro',
  z0.cbsa_code,
  z0.period_date,
  z0.value,
  z12.value,
  z36.value,
  CASE WHEN z12.value IS NOT NULL AND z0.value > 0
       THEN (z12.value - z0.value) / z0.value END,
  CASE WHEN z36.value IS NOT NULL AND z0.value > 0
       THEN POWER(z36.value / z0.value, 1.0/3.0) - 1 END
FROM zillow_metro z0
LEFT JOIN zillow_metro z12
  ON  z12.cbsa_code = z0.cbsa_code
  AND z12.metric_name = 'zhvi'
  AND date_trunc('month', z12.period_date) = date_trunc('month', z0.period_date + INTERVAL '12 months')
LEFT JOIN zillow_metro z36
  ON  z36.cbsa_code = z0.cbsa_code
  AND z36.metric_name = 'zhvi'
  AND date_trunc('month', z36.period_date) = date_trunc('month', z0.period_date + INTERVAL '36 months')
WHERE z0.metric_name = 'zhvi'
  AND z0.cbsa_code IS NOT NULL
ON CONFLICT (geography_level, location_id, period_date) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. Populate zhvi_forward_returns — COUNTY
-- ---------------------------------------------------------------------------

INSERT INTO zhvi_forward_returns
  (geography_level, location_id, period_date, zhvi_t0, zhvi_t12, zhvi_t36, return_1y, return_3y_ann)
SELECT
  'county',
  z0.fips_code,
  z0.period_date,
  z0.value,
  z12.value,
  z36.value,
  CASE WHEN z12.value IS NOT NULL AND z0.value > 0
       THEN (z12.value - z0.value) / z0.value END,
  CASE WHEN z36.value IS NOT NULL AND z0.value > 0
       THEN POWER(z36.value / z0.value, 1.0/3.0) - 1 END
FROM zillow_county z0
LEFT JOIN zillow_county z12
  ON  z12.fips_code = z0.fips_code
  AND z12.metric_name = 'zhvi'
  AND date_trunc('month', z12.period_date) = date_trunc('month', z0.period_date + INTERVAL '12 months')
LEFT JOIN zillow_county z36
  ON  z36.fips_code = z0.fips_code
  AND z36.metric_name = 'zhvi'
  AND date_trunc('month', z36.period_date) = date_trunc('month', z0.period_date + INTERVAL '36 months')
WHERE z0.metric_name = 'zhvi'
  AND z0.fips_code IS NOT NULL
ON CONFLICT (geography_level, location_id, period_date) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6. Populate zhvi_forward_returns — ZIP
-- (Largest table — run as a single statement, rely on PK unique index.
--  If this times out in a managed environment, chunk by substring(region_name,1,1).)
-- ---------------------------------------------------------------------------

INSERT INTO zhvi_forward_returns
  (geography_level, location_id, period_date, zhvi_t0, zhvi_t12, zhvi_t36, return_1y, return_3y_ann)
SELECT
  'zip',
  z0.region_name,
  z0.period_date,
  z0.value,
  z12.value,
  z36.value,
  CASE WHEN z12.value IS NOT NULL AND z0.value > 0
       THEN (z12.value - z0.value) / z0.value END,
  CASE WHEN z36.value IS NOT NULL AND z0.value > 0
       THEN POWER(z36.value / z0.value, 1.0/3.0) - 1 END
FROM zillow_zip z0
LEFT JOIN zillow_zip z12
  ON  z12.region_name = z0.region_name
  AND z12.metric_name = 'zhvi'
  AND date_trunc('month', z12.period_date) = date_trunc('month', z0.period_date + INTERVAL '12 months')
LEFT JOIN zillow_zip z36
  ON  z36.region_name = z0.region_name
  AND z36.metric_name = 'zhvi'
  AND date_trunc('month', z36.period_date) = date_trunc('month', z0.period_date + INTERVAL '36 months')
WHERE z0.metric_name = 'zhvi'
  AND z0.region_name IS NOT NULL
ON CONFLICT (geography_level, location_id, period_date) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 7. Populate score_geo_state_map
-- ---------------------------------------------------------------------------

-- County: FIPS → state_code via zillow_county
INSERT INTO score_geo_state_map (geography, location_id, state_code)
SELECT DISTINCT 'county', fips_code, state_code
FROM zillow_county
WHERE metric_name = 'zhvi' AND fips_code IS NOT NULL AND state_code IS NOT NULL
ON CONFLICT (geography, location_id) DO NOTHING;

-- Metro: CBSA → primary state_code via the metro crosswalk
-- (zillow_metro_crosswalk picks the largest-population-share state per CBSA)
INSERT INTO score_geo_state_map (geography, location_id, state_code)
SELECT DISTINCT 'metro', cbsa_code, zillow_state_name
FROM zillow_metro_crosswalk
WHERE cbsa_code IS NOT NULL AND zillow_state_name IS NOT NULL
ON CONFLICT (geography, location_id) DO NOTHING;

-- ZIP: ZIP → state_code via zillow_zip
INSERT INTO score_geo_state_map (geography, location_id, state_code)
SELECT DISTINCT 'zip', region_name, state_code
FROM zillow_zip
WHERE metric_name = 'zhvi' AND region_name IS NOT NULL AND state_code IS NOT NULL
ON CONFLICT (geography, location_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 8. Backfill propertyiq_scores_v2.return_1y and return_3y_ann
-- ---------------------------------------------------------------------------

UPDATE propertyiq_scores_v2 AS s
SET
  return_1y     = f.return_1y,
  return_3y_ann = f.return_3y_ann
FROM zhvi_forward_returns f
WHERE s.score_type = 'propertyiq'
  AND f.geography_level = s.geography
  AND f.location_id     = s.location_id
  AND date_trunc('month', f.period_date) = date_trunc('month', s.score_date);

COMMIT;
