-- Report Follow-Up Alerts
--
-- Stores metric watch thresholds extracted from report AI narratives.
-- Used for 30-day market updates and threshold-triggered alerts.

CREATE TABLE report_follow_up_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  metric_name TEXT NOT NULL,
  current_value NUMERIC,
  threshold_value NUMERIC NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('up', 'down')),
  rationale TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'triggered', 'dismissed')),
  triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Grant table permissions to Supabase roles
GRANT ALL ON report_follow_up_alerts TO service_role;
GRANT ALL ON report_follow_up_alerts TO authenticated;

ALTER TABLE report_follow_up_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_alerts" ON report_follow_up_alerts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "service_role_full_access" ON report_follow_up_alerts
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_follow_up_active ON report_follow_up_alerts (status, user_id)
  WHERE status = 'active';

CREATE INDEX idx_follow_up_report ON report_follow_up_alerts (report_id);
