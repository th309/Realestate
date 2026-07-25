-- Content pipeline: generalized posts model + brand kit foundation (Phase 2)
--
-- Generalizes the video-only content pipeline into a multi-format social
-- content platform. Adds:
--   brands                  — one brand kit per brand (voice, approved copy, platforms)
--   posts                   — ALL content types (not just video runs): one row per post
--   platform_connections    — per-brand social account links (Late aggregator or direct)
--   collections_preferences — per-brand saved style refs + signal weighting
--   analytics_snapshots      — per-post reach/engagement/follower deltas over time
--
-- RLS: admin/service-role only, mirroring content_pipeline_core.sql. Every table
-- gets the service_role_all policy plus GRANTs to service_role and authenticated
-- (project rule: new tables need explicit GRANTs for the API roles).
-- Idempotent: IF NOT EXISTS + DROP POLICY IF EXISTS throughout.

-- brands: the brand kit that feeds every generator's prompt preamble.
CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  website_url TEXT,
  voice_summary TEXT,
  tone_settings JSONB NOT NULL DEFAULT '{}',
  products JSONB NOT NULL DEFAULT '[]',
  target_platforms TEXT[] NOT NULL DEFAULT '{}',
  approved_copy JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON brands;
CREATE POLICY service_role_all ON brands FOR ALL USING (true);
GRANT ALL ON brands TO service_role;
GRANT ALL ON brands TO authenticated;

-- posts: one row per generated/scheduled/published social post, any format.
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  post_type TEXT NOT NULL,
  copy JSONB NOT NULL DEFAULT '{}',
  media_refs JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','pending_review','approved','scheduled','published','failed','skipped')),
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  platform_post_id TEXT,
  source TEXT NOT NULL DEFAULT 'ai_generated',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_posts_brand_status ON posts (brand_id, status);
CREATE INDEX IF NOT EXISTS idx_posts_status_scheduled ON posts (status, scheduled_at);
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON posts;
CREATE POLICY service_role_all ON posts FOR ALL USING (true);
GRANT ALL ON posts TO service_role;
GRANT ALL ON posts TO authenticated;

-- platform_connections: brand's linked social accounts (Late aggregator or direct API).
CREATE TABLE IF NOT EXISTS platform_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'late'
    CHECK (provider IN ('late','direct')),
  external_account_id TEXT,
  handle TEXT,
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'connected'
    CHECK (status IN ('connected','needs_reauth','disconnected')),
  meta JSONB NOT NULL DEFAULT '{}',
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (brand_id, platform, provider)
);
CREATE INDEX IF NOT EXISTS idx_platform_connections_brand ON platform_connections (brand_id);
ALTER TABLE platform_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON platform_connections;
CREATE POLICY service_role_all ON platform_connections FOR ALL USING (true);
GRANT ALL ON platform_connections TO service_role;
GRANT ALL ON platform_connections TO authenticated;

-- collections_preferences: per-brand saved style references + signal weighting for
-- preference learning (Phase 8 consumes this; created now so the brand kit is complete).
CREATE TABLE IF NOT EXISTS collections_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  saved_style_refs JSONB NOT NULL DEFAULT '[]',
  signal_weight NUMERIC NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_collections_preferences_brand ON collections_preferences (brand_id);
ALTER TABLE collections_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON collections_preferences;
CREATE POLICY service_role_all ON collections_preferences FOR ALL USING (true);
GRANT ALL ON collections_preferences TO service_role;
GRANT ALL ON collections_preferences TO authenticated;

-- analytics_snapshots: point-in-time reach/engagement/follower metrics per post.
-- post_id is nullable (brand-level snapshots allowed) and SET NULL on post delete
-- so historical analytics survive a deleted post.
CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  reach BIGINT,
  engagement BIGINT,
  followers_delta BIGINT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_brand_captured ON analytics_snapshots (brand_id, captured_at);
ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON analytics_snapshots;
CREATE POLICY service_role_all ON analytics_snapshots FOR ALL USING (true);
GRANT ALL ON analytics_snapshots TO service_role;
GRANT ALL ON analytics_snapshots TO authenticated;
