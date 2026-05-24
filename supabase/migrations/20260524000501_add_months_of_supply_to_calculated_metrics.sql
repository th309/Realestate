-- Computed months_of_supply fallback, sourced from new-format housing_market.
-- The PropertyIQ score reads MoS from legacy redfin_* tables; this column is the
-- fallback the score uses when the legacy source is absent (survives legacy
-- deprecation). Populated by the redfin-dc MoS post-import hook.
ALTER TABLE calculated_metrics
  ADD COLUMN IF NOT EXISTS months_of_supply NUMERIC;

-- Point-in-time MoS = active listings / homes sold. NULL-safe.
CREATE OR REPLACE FUNCTION compute_months_of_supply(
  active_listings NUMERIC,
  homes_sold NUMERIC
) RETURNS NUMERIC
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN homes_sold IS NULL OR homes_sold = 0 THEN NULL
    ELSE active_listings / homes_sold
  END;
$$;

GRANT EXECUTE ON FUNCTION compute_months_of_supply(NUMERIC, NUMERIC)
  TO service_role, authenticated;
