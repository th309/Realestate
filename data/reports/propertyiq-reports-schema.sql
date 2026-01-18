-- ============================================================================
-- PROPERTYIQ REPORTS SYSTEM - DATABASE SCHEMA
-- ============================================================================

-- Report Templates (the 5 master formats + custom/white-label)
CREATE TABLE report_templates (
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
  created_by UUID REFERENCES users(id)
);

-- Report Instances (generated reports with actual data)
CREATE TABLE report_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Links
  template_id UUID REFERENCES report_templates(id) NOT NULL,
  template_version INTEGER NOT NULL,
  user_id UUID REFERENCES users(id) NOT NULL,
  organization_id UUID REFERENCES organizations(id),
  
  -- Geography
  primary_geography_id TEXT NOT NULL,
  primary_geography_type TEXT NOT NULL,
  primary_geography_name TEXT NOT NULL,
  comparison_geographies JSONB,
  
  -- User inputs at generation time
  user_inputs JSONB DEFAULT '{}',
  
  -- The populated report data
  populated_data JSONB NOT NULL,
  ai_narratives JSONB,
  
  -- Scores snapshot
  homeready_score INTEGER,
  investoredge_score INTEGER,
  
  -- Status and metadata
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  data_as_of_date DATE,
  confidence_level TEXT,
  generation_time_ms INTEGER,
  
  -- Branding
  branding_override JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  last_viewed_at TIMESTAMPTZ
);

-- Report Conversations
CREATE TABLE report_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_instance_id UUID REFERENCES report_instances(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) NOT NULL,
  messages JSONB DEFAULT '[]',
  user_profile JSONB DEFAULT '{}',
  exchange_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Saved Insights
CREATE TABLE saved_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  report_instance_id UUID REFERENCES report_instances(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES report_conversations(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  insight_text TEXT NOT NULL,
  user_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Memory (Pro tier)
CREATE TABLE user_report_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) UNIQUE NOT NULL,
  researched_geographies JSONB DEFAULT '[]',
  investment_criteria JSONB,
  preferences JSONB DEFAULT '{}',
  remember_preferences BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- News Cache
CREATE TABLE report_news_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geography_id TEXT,
  geography_type TEXT,
  geography_name TEXT,
  headline TEXT NOT NULL,
  summary TEXT,
  source TEXT,
  source_url TEXT,
  published_at TIMESTAMPTZ,
  category TEXT,
  relevance_score FLOAT,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

-- Report Alerts
CREATE TABLE report_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  geography_id TEXT NOT NULL,
  geography_type TEXT NOT NULL,
  metric TEXT NOT NULL,
  condition TEXT NOT NULL,
  threshold NUMERIC NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  notify_email BOOLEAN DEFAULT true,
  notify_push BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_templates_slug ON report_templates(slug);
CREATE INDEX idx_templates_org ON report_templates(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX idx_templates_active ON report_templates(is_active, is_public);

CREATE INDEX idx_instances_user ON report_instances(user_id);
CREATE INDEX idx_instances_template ON report_instances(template_id);
CREATE INDEX idx_instances_geography ON report_instances(primary_geography_id, primary_geography_type);
CREATE INDEX idx_instances_status ON report_instances(status);
CREATE INDEX idx_instances_created ON report_instances(created_at DESC);
CREATE INDEX idx_instances_user_recent ON report_instances(user_id, created_at DESC);

CREATE INDEX idx_conversations_report ON report_conversations(report_instance_id);
CREATE INDEX idx_conversations_user ON report_conversations(user_id);

CREATE INDEX idx_news_geography ON report_news_cache(geography_id, geography_type);
CREATE INDEX idx_news_expires ON report_news_cache(expires_at);

CREATE INDEX idx_alerts_user ON report_alerts(user_id, is_active);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_report_templates_updated_at
  BEFORE UPDATE ON report_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_report_instances_updated_at
  BEFORE UPDATE ON report_instances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_report_conversations_updated_at
  BEFORE UPDATE ON report_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

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

CREATE TRIGGER increment_template_version_trigger
  BEFORE UPDATE ON report_templates
  FOR EACH ROW EXECUTE FUNCTION increment_template_version();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_report_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_alerts ENABLE ROW LEVEL SECURITY;

-- Templates: Anyone can read active public templates
CREATE POLICY "Public templates viewable by everyone"
  ON report_templates FOR SELECT
  USING (is_active = true AND is_public = true AND organization_id IS NULL);

-- Instances: Users can only see their own reports
CREATE POLICY "Users can view own reports"
  ON report_instances FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create own reports"
  ON report_instances FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own reports"
  ON report_instances FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own reports"
  ON report_instances FOR DELETE USING (user_id = auth.uid());

-- Conversations
CREATE POLICY "Users can manage own conversations"
  ON report_conversations FOR ALL USING (user_id = auth.uid());

-- Insights
CREATE POLICY "Users can manage own insights"
  ON saved_insights FOR ALL USING (user_id = auth.uid());

-- Memory
CREATE POLICY "Users can manage own memory"
  ON user_report_memory FOR ALL USING (user_id = auth.uid());

-- Alerts
CREATE POLICY "Users can manage own alerts"
  ON report_alerts FOR ALL USING (user_id = auth.uid());

-- ============================================================================
-- VIEWS
-- ============================================================================

CREATE VIEW user_reports_view AS
SELECT 
  ri.id,
  ri.user_id,
  ri.status,
  ri.created_at,
  ri.primary_geography_name,
  ri.primary_geography_type,
  ri.homeready_score,
  ri.investoredge_score,
  ri.data_as_of_date,
  rt.slug as template_slug,
  rt.name as template_name,
  rt.icon as template_icon
FROM report_instances ri
JOIN report_templates rt ON ri.template_id = rt.id;
