-- Churn reason responses: captures the "why did you leave" signal from the
-- cohort-aware churn-why email drip (zero_session / tried_once / engaged_quiet).
-- Written server-side via a signed-token endpoint (POST /api/surveys/churn) —
-- users never query this table directly, matching the user_surveys pattern.

CREATE TABLE IF NOT EXISTS churn_survey_responses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cohort       TEXT NOT NULL CHECK (cohort IN ('zero_session', 'tried_once', 'engaged_quiet')),
  email_type   TEXT NOT NULL,
  reason_code  TEXT NOT NULL,
  detail       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One response per user per email variant (matches user_surveys' upsert pattern)
CREATE UNIQUE INDEX IF NOT EXISTS idx_churn_survey_responses_user_email_type
  ON churn_survey_responses (user_id, email_type);

CREATE INDEX IF NOT EXISTS idx_churn_survey_responses_user
  ON churn_survey_responses (user_id);

ALTER TABLE churn_survey_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS churn_survey_responses_service_role ON churn_survey_responses;
CREATE POLICY churn_survey_responses_service_role ON churn_survey_responses
  FOR ALL USING (auth.role() = 'service_role');

-- GRANT required for new Supabase API keys (sb_secret_ / sb_publishable_) —
-- without it, even service_role JWTs hit permission-denied.
GRANT ALL ON churn_survey_responses TO service_role;
