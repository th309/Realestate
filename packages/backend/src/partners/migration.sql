-- Partner configuration for contextual recommendations in reports
-- Apply this migration via Supabase dashboard or CLI
-- Project: nkknbvfegwfmstrdakbk

CREATE TABLE IF NOT EXISTS partner_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  context_type TEXT NOT NULL,  -- 'affordability', 'timing', 'stability', 'growth', 'verdict', 'cash_flow', 'entry_point', 'risk', 'pro_forma', 'agent_services'
  description_template TEXT NOT NULL,  -- Supports {{score_component}}, {{score_value}}, {{geography_name}} interpolation
  cta_text TEXT NOT NULL,
  cta_url TEXT NOT NULL,
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  geography_filter JSONB,  -- Optional: restrict to specific geographies {"types": ["metro"], "ids": ["12345"]}
  tier_filter TEXT[],  -- Optional: restrict to specific user tiers
  priority INTEGER DEFAULT 0,  -- Higher priority wins when multiple match
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient lookup during report generation
CREATE INDEX idx_partner_config_context_active ON partner_config(context_type) WHERE is_active = true;

-- Add RLS policy (service role only - partners are admin-managed)
ALTER TABLE partner_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can manage partner_config" ON partner_config
  FOR ALL USING (auth.role() = 'service_role');
