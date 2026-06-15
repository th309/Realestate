-- screener_snapshot: one denormalized row per (geo_level, region_id) holding the
-- latest PropertyIQ score + price + market metrics, so the /api/screener/:geo
-- endpoint is a single indexed WHERE/ORDER BY/LIMIT instead of a per-request
-- cross-table join. Refreshed monthly by the calculated-metrics orchestrator
-- (screener.service.ts refreshScreenerSnapshot) after scores + calculated_metrics
-- are computed. Read-only public market aggregates (mirrors calculated_metrics
-- grants); the backend reads it via the service role.

CREATE TABLE IF NOT EXISTS screener_snapshot (
  geo_level        text    NOT NULL,            -- 'metro' | 'county' | 'zip'
  region_id        text    NOT NULL,            -- cbsa_code / county_fips / postal_code
  region_name      text,
  state_code       text,
  -- PropertyIQ score (from propertyiq_scores)
  score            numeric,
  grade            text,
  confidence       numeric,
  -- price / rent
  median_price     numeric,                     -- propertyiq_scores.median_price (ZHVI-derived)
  home_value       numeric,                     -- zillow ZHVI
  rent             numeric,                      -- zillow ZORI
  -- investment / market metrics (from calculated_metrics)
  cap_rate         numeric,
  gross_yield      numeric,
  rent_to_price_ratio numeric,
  grm              numeric,
  months_of_supply numeric,
  overvalued_pct   numeric,
  -- provenance
  as_of            date,                        -- period the metrics reflect (latest score date)
  refreshed_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (geo_level, region_id)
);

-- Default sort + the common filters are by geo level; score is the default rank.
CREATE INDEX IF NOT EXISTS idx_screener_snapshot_geo_score
  ON screener_snapshot (geo_level, score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_screener_snapshot_geo_state
  ON screener_snapshot (geo_level, state_code);

-- Grants mirror calculated_metrics (public read; backend writes via service role).
GRANT SELECT ON screener_snapshot TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON screener_snapshot TO authenticated;
GRANT ALL ON screener_snapshot TO service_role;
