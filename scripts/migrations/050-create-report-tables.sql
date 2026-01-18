-- ============================================================================
-- MIGRATION 050: PROPERTYIQ REPORTS SYSTEM ENHANCEMENTS
-- ============================================================================
-- This migration extends the existing reports schema from migration 030
-- to support the templated PropertyIQ report system.
-- ============================================================================

-- ============================================================================
-- SECTION 1: NEW TABLES
-- ============================================================================

-- Report Templates (the 5 master formats + custom/white-label)
CREATE TABLE IF NOT EXISTS report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  slug TEXT UNIQUE NOT NULL,              -- 'snapshot', 'comparison', etc.
  name TEXT NOT NULL,                     -- 'Market Snapshot'
  description TEXT,
  icon TEXT,                              -- Icon name for UI
  version INTEGER DEFAULT 1,              -- Increment when template changes

  -- Access control
  tier_required TEXT DEFAULT 'free',      -- 'free', 'basic', 'pro', 'enterprise'
  is_active BOOLEAN DEFAULT true,
  is_public BOOLEAN DEFAULT true,         -- Show in template picker

  -- Template definition (the structure)
  config JSONB NOT NULL,

  -- For white-label/custom templates
  organization_id UUID REFERENCES organizations(id),
  base_template_id UUID REFERENCES report_templates(id),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES user_profiles(id)
);

-- Saved Insights (bookmarked AI responses)
CREATE TABLE IF NOT EXISTS saved_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES report_conversations(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  insight_text TEXT NOT NULL,
  user_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SECTION 2: ALTER EXISTING TABLES
-- ============================================================================

-- Add template-related columns to reports table
DO $$
BEGIN
  -- template_id: Link to report_templates
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'reports' AND column_name = 'template_id') THEN
    ALTER TABLE reports ADD COLUMN template_id UUID REFERENCES report_templates(id);
  END IF;

  -- template_version: Version of template used
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'reports' AND column_name = 'template_version') THEN
    ALTER TABLE reports ADD COLUMN template_version INTEGER;
  END IF;

  -- user_type: 'homebuyer' or 'investor' for score hero selection
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'reports' AND column_name = 'user_type') THEN
    ALTER TABLE reports ADD COLUMN user_type TEXT DEFAULT 'homebuyer';
  END IF;

  -- populated_data: Structured data from template
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'reports' AND column_name = 'populated_data') THEN
    ALTER TABLE reports ADD COLUMN populated_data JSONB;
  END IF;

  -- homeready_score: Cached score for quick access
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'reports' AND column_name = 'homeready_score') THEN
    ALTER TABLE reports ADD COLUMN homeready_score INTEGER;
  END IF;

  -- investoredge_score: Cached score for quick access
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'reports' AND column_name = 'investoredge_score') THEN
    ALTER TABLE reports ADD COLUMN investoredge_score INTEGER;
  END IF;

  -- confidence_level: Data quality indicator
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'reports' AND column_name = 'confidence_level') THEN
    ALTER TABLE reports ADD COLUMN confidence_level TEXT;
  END IF;

  -- generation_time_ms: Performance tracking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'reports' AND column_name = 'generation_time_ms') THEN
    ALTER TABLE reports ADD COLUMN generation_time_ms INTEGER;
  END IF;

  -- share_token: Unique sharing token (may exist as public_slug)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'reports' AND column_name = 'share_token') THEN
    ALTER TABLE reports ADD COLUMN share_token VARCHAR(64) UNIQUE;
  END IF;

  -- share_access_level: 'view' or 'download'
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'reports' AND column_name = 'share_access_level') THEN
    ALTER TABLE reports ADD COLUMN share_access_level TEXT DEFAULT 'view';
  END IF;

  -- share_view_count: Track share views
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'reports' AND column_name = 'share_view_count') THEN
    ALTER TABLE reports ADD COLUMN share_view_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- Add user_profile and exchange tracking to conversations
DO $$
BEGIN
  -- user_profile: Learned profile about the user from conversation
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'report_conversations' AND column_name = 'user_profile') THEN
    ALTER TABLE report_conversations ADD COLUMN user_profile JSONB DEFAULT '{}';
  END IF;

  -- exchange_count: Number of back-and-forth exchanges
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'report_conversations' AND column_name = 'exchange_count') THEN
    ALTER TABLE report_conversations ADD COLUMN exchange_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- Add investment_criteria to user_report_memory
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'user_report_memory' AND column_name = 'investment_criteria') THEN
    ALTER TABLE user_report_memory ADD COLUMN investment_criteria JSONB;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'user_report_memory' AND column_name = 'preferences') THEN
    ALTER TABLE user_report_memory ADD COLUMN preferences JSONB DEFAULT '{}';
  END IF;
END $$;

-- ============================================================================
-- SECTION 3: INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_templates_slug ON report_templates(slug);
CREATE INDEX IF NOT EXISTS idx_templates_org ON report_templates(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_templates_active ON report_templates(is_active, is_public);

CREATE INDEX IF NOT EXISTS idx_saved_insights_user ON saved_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_insights_report ON saved_insights(report_id);

-- Additional indexes for reports table new columns
CREATE INDEX IF NOT EXISTS idx_reports_template ON reports(template_id) WHERE template_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reports_user_type ON reports(user_type);
CREATE INDEX IF NOT EXISTS idx_reports_share_token ON reports(share_token) WHERE share_token IS NOT NULL;

-- ============================================================================
-- SECTION 4: TRIGGERS
-- ============================================================================

-- Create or replace the updated_at trigger function for templates
CREATE OR REPLACE FUNCTION update_report_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_report_templates_timestamp ON report_templates;
CREATE TRIGGER update_report_templates_timestamp
  BEFORE UPDATE ON report_templates
  FOR EACH ROW EXECUTE FUNCTION update_report_templates_updated_at();

-- Auto-increment template version on config change
CREATE OR REPLACE FUNCTION increment_template_version()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.config IS DISTINCT FROM NEW.config THEN
    NEW.version = OLD.version + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS increment_template_version_trigger ON report_templates;
CREATE TRIGGER increment_template_version_trigger
  BEFORE UPDATE ON report_templates
  FOR EACH ROW EXECUTE FUNCTION increment_template_version();

-- ============================================================================
-- SECTION 5: GRANT PERMISSIONS FOR SERVICE ROLE
-- ============================================================================

GRANT ALL ON report_templates TO service_role;
GRANT ALL ON saved_insights TO service_role;

-- ============================================================================
-- SECTION 6: VIEW FOR USER REPORTS
-- ============================================================================

CREATE OR REPLACE VIEW user_reports_view AS
SELECT
  r.id,
  r.user_id,
  r.user_type,
  r.status,
  r.created_at,
  r.title,
  r.report_type,
  r.primary_geography_name,
  r.primary_geography_type,
  r.homeready_score,
  r.investoredge_score,
  r.data_as_of_date,
  r.share_token,
  r.view_count,
  rt.slug as template_slug,
  rt.name as template_name,
  rt.icon as template_icon,
  up.subscription_tier
FROM reports r
LEFT JOIN report_templates rt ON r.template_id = rt.id
LEFT JOIN user_profiles up ON r.user_id = up.id;

GRANT SELECT ON user_reports_view TO service_role;
