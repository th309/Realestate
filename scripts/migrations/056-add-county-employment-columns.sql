-- Migration 056: Add employment columns to economic_county table
-- QCEW provides employment data for all US counties, filling the gap from FRED

-- Add employment columns to economic_county if they don't exist
ALTER TABLE economic_county
ADD COLUMN IF NOT EXISTS total_nonfarm_employment DECIMAL,
ADD COLUMN IF NOT EXISTS employment_yoy DECIMAL;

-- Note: The get_latest_economic_county function already supports employment_yoy
-- (added in migration 054)
