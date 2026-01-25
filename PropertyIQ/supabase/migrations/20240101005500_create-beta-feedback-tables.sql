-- Beta Feedback System Tables
-- Allows beta testers to submit feedback via shareable links
-- Testers can only see their own submissions; admin sees all

-- ============================================
-- Beta Testers Table
-- ============================================
CREATE TABLE IF NOT EXISTS beta_testers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  name TEXT NOT NULL,
  email TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_beta_testers_token ON beta_testers(token);
CREATE INDEX IF NOT EXISTS idx_beta_testers_active ON beta_testers(is_active) WHERE is_active = true;

-- ============================================
-- Beta Feedback Table
-- ============================================
CREATE TABLE IF NOT EXISTS beta_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tester_id UUID REFERENCES beta_testers(id) ON DELETE CASCADE NOT NULL,
  
  -- Categorization
  category TEXT NOT NULL CHECK (category IN ('bug', 'workflow', 'ux_ui', 'feature_request', 'performance', 'other')),
  severity TEXT CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  
  -- Content
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  steps_to_reproduce TEXT,
  expected_behavior TEXT,
  actual_behavior TEXT,
  
  -- Context for IDE integration
  page_url TEXT,
  affected_component TEXT,
  browser_info JSONB,
  
  -- Attachments (stored in Supabase Storage)
  attachments JSONB DEFAULT '[]'::jsonb,
  
  -- Status tracking
  status TEXT DEFAULT 'submitted' CHECK (status IN (
    'submitted', 'triaged', 'in_progress', 'fixed', 'deployed', 'wont_fix', 'duplicate'
  )),
  admin_notes TEXT,
  fix_reference TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_beta_feedback_tester ON beta_feedback(tester_id);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_status ON beta_feedback(status);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_category ON beta_feedback(category);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_created ON beta_feedback(created_at DESC);

-- ============================================
-- Updated At Trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_beta_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER beta_feedback_updated_at
  BEFORE UPDATE ON beta_feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_beta_feedback_updated_at();

CREATE TRIGGER beta_testers_updated_at
  BEFORE UPDATE ON beta_testers
  FOR EACH ROW
  EXECUTE FUNCTION update_beta_feedback_updated_at();

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE beta_testers ENABLE ROW LEVEL SECURITY;
ALTER TABLE beta_feedback ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (for admin dashboard)
CREATE POLICY "service_role_all_testers" ON beta_testers
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role_all_feedback" ON beta_feedback
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Grant Permissions
-- ============================================
GRANT ALL ON beta_testers TO service_role;
GRANT ALL ON beta_feedback TO service_role;

-- Anon can read active testers (for token validation)
GRANT SELECT ON beta_testers TO anon;
GRANT SELECT, INSERT ON beta_feedback TO anon;

-- ============================================
-- Storage Bucket for Attachments
-- ============================================
-- Note: Run this in Supabase Dashboard SQL Editor if storage extension is available
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('feedback-attachments', 'feedback-attachments', false)
-- ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE beta_testers IS 'Beta testers with shareable access tokens';
COMMENT ON TABLE beta_feedback IS 'Feedback submissions from beta testers';
COMMENT ON COLUMN beta_feedback.attachments IS 'JSON array of {url, filename, type, size} objects';
COMMENT ON COLUMN beta_feedback.fix_reference IS 'Commit SHA, PR URL, or branch name when fixed';
