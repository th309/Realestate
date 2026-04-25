-- Content pipeline P2 Task 2.29: script archetypes + clusters + transcript cache.
-- Idempotent (CREATE TABLE IF NOT EXISTS); safe to re-run.

-- transcript_cache: yt-dlp output cached per-video for clustering passes
CREATE TABLE IF NOT EXISTS transcript_cache (
  video_id TEXT PRIMARY KEY,
  source_platform TEXT NOT NULL DEFAULT 'youtube',
  channel_id TEXT,
  channel_title TEXT,
  title TEXT NOT NULL,
  description TEXT,
  transcript TEXT,
  view_count BIGINT,
  like_count BIGINT,
  comment_count BIGINT,
  published_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  embedding JSONB,                  -- vector representation, stored as JSON for now (pgvector swap is P3)
  embedding_model TEXT,
  failure_reason TEXT               -- non-null when fetch failed; transcript itself stays null
);
CREATE INDEX IF NOT EXISTS idx_transcript_cache_channel ON transcript_cache (channel_id);
CREATE INDEX IF NOT EXISTS idx_transcript_cache_fetched ON transcript_cache (fetched_at DESC);
ALTER TABLE transcript_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON transcript_cache;
CREATE POLICY service_role_all ON transcript_cache FOR ALL USING (true);
GRANT ALL ON transcript_cache TO service_role;
GRANT ALL ON transcript_cache TO authenticated;

-- archetype_clusters: each row is a cluster discovered from transcript_cache
-- via the embedding-similarity clustering pass (Task 2.31).
CREATE TABLE IF NOT EXISTS archetype_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_label TEXT NOT NULL,         -- short human-readable label, e.g. "Top-10 ranking with score reveal"
  centroid_embedding JSONB,            -- mean of member embeddings
  member_video_ids TEXT[] NOT NULL DEFAULT '{}',
  member_count INTEGER NOT NULL DEFAULT 0,
  median_view_count BIGINT,
  refresh_run_id UUID,                 -- traceable back to the cron run that produced this cluster
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_archetype_clusters_refresh ON archetype_clusters (refresh_run_id);
ALTER TABLE archetype_clusters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON archetype_clusters;
CREATE POLICY service_role_all ON archetype_clusters FOR ALL USING (true);
GRANT ALL ON archetype_clusters TO service_role;
GRANT ALL ON archetype_clusters TO authenticated;

-- script_archetypes: the operator-facing rows that the New Run wizard
-- exposes. ScriptArchetypeService promotes the strongest clusters to
-- archetypes and writes the synthesized prompt structure here.
CREATE TABLE IF NOT EXISTS script_archetypes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,           -- stable URL slug, e.g. "top10_score_reveal"
  display_name TEXT NOT NULL,
  description TEXT,
  source_cluster_id UUID REFERENCES archetype_clusters(id) ON DELETE SET NULL,
  format_affinity TEXT[] NOT NULL DEFAULT '{}',  -- which formats this archetype slots into
  prompt_template TEXT NOT NULL,                  -- handlebars-ish template the script generator uses
  example_video_ids TEXT[] NOT NULL DEFAULT '{}',
  median_view_count BIGINT,
  member_count INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_script_archetypes_format_affinity ON script_archetypes USING GIN (format_affinity);
ALTER TABLE script_archetypes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON script_archetypes;
CREATE POLICY service_role_all ON script_archetypes FOR ALL USING (true);
GRANT ALL ON script_archetypes TO service_role;
GRANT ALL ON script_archetypes TO authenticated;

-- archetype_refresh_runs: audit trail of the discovery → cluster → promote pipeline.
CREATE TABLE IF NOT EXISTS archetype_refresh_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'queued',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  videos_discovered INTEGER NOT NULL DEFAULT 0,
  transcripts_fetched INTEGER NOT NULL DEFAULT 0,
  clusters_built INTEGER NOT NULL DEFAULT 0,
  archetypes_promoted INTEGER NOT NULL DEFAULT 0,
  total_cost_usd NUMERIC NOT NULL DEFAULT 0,
  error_message TEXT
);
ALTER TABLE archetype_refresh_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON archetype_refresh_runs;
CREATE POLICY service_role_all ON archetype_refresh_runs FOR ALL USING (true);
GRANT ALL ON archetype_refresh_runs TO service_role;
GRANT ALL ON archetype_refresh_runs TO authenticated;
