-- Content pipeline distribution tables
-- Part of P1 foundation per docs/content-pipeline/implementation-plan.md Task 1.4

-- short_links: piq.sh tracking slugs; one per platform_post
CREATE TABLE IF NOT EXISTS short_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  run_id UUID NOT NULL REFERENCES content_runs(id) ON DELETE CASCADE,
  format TEXT NOT NULL,
  platform TEXT NOT NULL,
  target_url TEXT NOT NULL,
  click_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_short_links_slug ON short_links (slug);
ALTER TABLE short_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON short_links;
CREATE POLICY service_role_all ON short_links FOR ALL USING (true);
GRANT ALL ON short_links TO service_role;
GRANT ALL ON short_links TO authenticated;

-- platform_posts: one per (run, platform) combination
CREATE TABLE IF NOT EXISTS platform_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES content_runs(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  external_id TEXT,
  external_url TEXT,
  post_mode TEXT NOT NULL DEFAULT 'direct',
  scheduled_for TIMESTAMPTZ,
  short_link_id UUID REFERENCES short_links(id) ON DELETE SET NULL,
  hook_variant_id TEXT,
  status TEXT NOT NULL DEFAULT 'uploading',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_platform_posts_platform_external ON platform_posts (platform, external_id) WHERE external_id IS NOT NULL;
ALTER TABLE platform_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON platform_posts;
CREATE POLICY service_role_all ON platform_posts FOR ALL USING (true);
GRANT ALL ON platform_posts TO service_role;
GRANT ALL ON platform_posts TO authenticated;

-- content_metrics: time-series analytics pulled at 24h, 7d, 30d windows
CREATE TABLE IF NOT EXISTS content_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_post_id UUID NOT NULL REFERENCES platform_posts(id) ON DELETE CASCADE,
  pulled_at_window TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  watch_time_seconds INTEGER NOT NULL DEFAULT 0,
  avg_retention_pct REAL,
  likes INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0,
  follows_gained INTEGER NOT NULL DEFAULT 0,
  short_link_clicks INTEGER NOT NULL DEFAULT 0,
  raw_payload JSONB,
  pulled_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_content_metrics_post_window ON content_metrics (platform_post_id, pulled_at_window);
ALTER TABLE content_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON content_metrics;
CREATE POLICY service_role_all ON content_metrics FOR ALL USING (true);
GRANT ALL ON content_metrics TO service_role;
GRANT ALL ON content_metrics TO authenticated;
