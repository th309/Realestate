-- Add fields needed by tour anon-claim flow.
-- Existing reports table is reused for claimed anon reports.

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS anon_session_id TEXT,
  ADD COLUMN IF NOT EXISTS market_geo_level TEXT,
  ADD COLUMN IF NOT EXISTS market_geo_id TEXT,
  ADD COLUMN IF NOT EXISTS market_name TEXT,
  ADD COLUMN IF NOT EXISTS report_type TEXT DEFAULT 'listing_presentation',
  ADD COLUMN IF NOT EXISTS payload JSONB;

CREATE INDEX IF NOT EXISTS idx_reports_anon_session_id ON reports(anon_session_id) WHERE anon_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reports_user_market ON reports(user_id, market_geo_level, market_geo_id);

GRANT ALL ON reports TO service_role;
GRANT ALL ON reports TO authenticated;
