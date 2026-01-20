-- Migration 059: Backfill null total_units_yoy in permits tables
-- Calculates YoY from prior year data where available

-- Step 1: Update county YoY where prior year data exists
UPDATE permits_county c
SET total_units_yoy = ROUND(
  ((c.total_units - prev.total_units)::numeric / NULLIF(prev.total_units, 0)) * 100,
  2
)
FROM permits_county prev
WHERE prev.fips_code = c.fips_code
  AND prev.period_date = (c.period_date - INTERVAL '1 year')::date
  AND c.total_units_yoy IS NULL
  AND c.total_units IS NOT NULL
  AND prev.total_units IS NOT NULL
  AND prev.total_units > 0;

-- Step 2: Set YoY to 0 where both current and prior year = 0
UPDATE permits_county c
SET total_units_yoy = 0
FROM permits_county prev
WHERE prev.fips_code = c.fips_code
  AND prev.period_date = (c.period_date - INTERVAL '1 year')::date
  AND c.total_units_yoy IS NULL
  AND c.total_units = 0
  AND prev.total_units = 0;

-- Step 3: Set YoY to 100 for "new activity" (prior = 0, current > 0)
-- This represents counties that went from no permits to having permits
UPDATE permits_county c
SET total_units_yoy = 100
FROM permits_county prev
WHERE prev.fips_code = c.fips_code
  AND prev.period_date = (c.period_date - INTERVAL '1 year')::date
  AND c.total_units_yoy IS NULL
  AND c.total_units > 0
  AND prev.total_units = 0;

-- Step 4: Repeat for state table
UPDATE permits_state s
SET total_units_yoy = ROUND(
  ((s.total_units - prev.total_units)::numeric / NULLIF(prev.total_units, 0)) * 100,
  2
)
FROM permits_state prev
WHERE prev.state_fips = s.state_fips
  AND prev.period_date = (s.period_date - INTERVAL '1 year')::date
  AND s.total_units_yoy IS NULL
  AND s.total_units IS NOT NULL
  AND prev.total_units IS NOT NULL
  AND prev.total_units > 0;

UPDATE permits_state s
SET total_units_yoy = 0
FROM permits_state prev
WHERE prev.state_fips = s.state_fips
  AND prev.period_date = (s.period_date - INTERVAL '1 year')::date
  AND s.total_units_yoy IS NULL
  AND s.total_units = 0
  AND prev.total_units = 0;

UPDATE permits_state s
SET total_units_yoy = 100
FROM permits_state prev
WHERE prev.state_fips = s.state_fips
  AND prev.period_date = (s.period_date - INTERVAL '1 year')::date
  AND s.total_units_yoy IS NULL
  AND s.total_units > 0
  AND prev.total_units = 0;
