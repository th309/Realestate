-- Migration: Create market_insights table
-- Purpose: Cache layer for AI-generated market insights (market takes, score explanations, etc.)
-- Generated insights are keyed by region + geo level + insight type, with optional archetype personalization.
-- The UNIQUE constraint enables upsert behavior — regenerating an insight replaces the previous one.

CREATE TABLE IF NOT EXISTS market_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id TEXT NOT NULL,
  geo_level TEXT NOT NULL CHECK (geo_level IN ('state', 'metro', 'county', 'zip')),
  insight_type TEXT NOT NULL CHECK (insight_type IN ('market_take', 'score_explanation', 'trend_interpretation', 'market_overview', 'archetype_match')),
  content TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'deepseek-chat',
  archetype_id TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  scoring_run_id TEXT,
  UNIQUE(region_id, geo_level, insight_type, archetype_id)
);

CREATE INDEX IF NOT EXISTS idx_market_insights_lookup ON market_insights(region_id, geo_level, insight_type);
CREATE INDEX IF NOT EXISTS idx_market_insights_expiry ON market_insights(expires_at);
