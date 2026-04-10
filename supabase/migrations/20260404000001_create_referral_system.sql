-- Referral tracking system
-- Enables users to earn 1 free Pro month per referred user who converts to paid.
-- referral_codes: one unique code per user, lazy-generated on first request
-- referral_events: tracks each referral from signup through paid conversion

-- ─── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS referral_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  code text NOT NULL,
  -- signed_up: referred user created an account
  -- converted: referred user became a paying Pro subscriber
  state text NOT NULL DEFAULT 'signed_up' CHECK (state IN ('signed_up', 'converted')),
  credit_applied_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ─── user_profiles credit column ─────────────────────────────────────────────

-- Free-tier users accumulate credits here; applied when they subscribe.
-- Paid users get their Stripe subscription period extended directly.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS referral_credit_months_remaining integer NOT NULL DEFAULT 0;

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_referral_codes_user_id ON referral_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referral_events_referrer_id ON referral_events(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_events_referred_id ON referral_events(referred_id);
CREATE INDEX IF NOT EXISTS idx_referral_events_state ON referral_events(state);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_events ENABLE ROW LEVEL SECURITY;

-- referral_codes: users can read their own code
CREATE POLICY "Users can read own referral code"
  ON referral_codes FOR SELECT
  USING (auth.uid() = user_id);

-- referral_events: users can read events where they are the referrer
CREATE POLICY "Users can read own referral events"
  ON referral_events FOR SELECT
  USING (auth.uid() = referrer_id);

-- ─── Grants ───────────────────────────────────────────────────────────────────

-- Service role (NestJS backend) gets full access via service key — no extra grant needed.
-- Authenticated role gets read access so the frontend can display referral stats.
GRANT SELECT ON referral_codes TO authenticated;
GRANT SELECT ON referral_events TO authenticated;

-- ─── updated_at trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_referral_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_referral_events_updated_at
  BEFORE UPDATE ON referral_events
  FOR EACH ROW
  EXECUTE FUNCTION update_referral_events_updated_at();
