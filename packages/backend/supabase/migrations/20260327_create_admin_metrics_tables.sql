-- Migration: create_admin_metrics_tables
-- Purpose: Create 7 time-series snapshot tables for the admin command center metrics system.
-- These tables are written by NestJS cron jobs and queried by the frontend dashboard charts.

-- 1. admin_health_snapshots
-- Stores per-source data freshness and availability health checks.
CREATE TABLE IF NOT EXISTS admin_health_snapshots (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp         timestamptz NOT NULL    DEFAULT now(),
  source_name       text        NOT NULL,
  available         bool        NOT NULL,
  fresh             bool        NOT NULL,
  days_since_update int         NOT NULL    DEFAULT 0,
  response_time_ms  int         NOT NULL    DEFAULT 0,
  error_message     text
);

CREATE INDEX IF NOT EXISTS idx_admin_health_snapshots_timestamp
  ON admin_health_snapshots (timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_admin_health_snapshots_source_timestamp
  ON admin_health_snapshots (source_name, timestamp DESC);

GRANT ALL ON admin_health_snapshots TO service_role;
GRANT ALL ON admin_health_snapshots TO authenticated;

-- 2. admin_api_metrics
-- Stores API endpoint latency percentiles and error rates per collection interval.
CREATE TABLE IF NOT EXISTS admin_api_metrics (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp     timestamptz NOT NULL    DEFAULT now(),
  endpoint      text        NOT NULL,
  p50_ms        real        NOT NULL    DEFAULT 0,
  p95_ms        real        NOT NULL    DEFAULT 0,
  p99_ms        real        NOT NULL    DEFAULT 0,
  request_count int         NOT NULL    DEFAULT 0,
  error_count   int         NOT NULL    DEFAULT 0,
  error_rate    real        NOT NULL    DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_admin_api_metrics_timestamp
  ON admin_api_metrics (timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_admin_api_metrics_endpoint_timestamp
  ON admin_api_metrics (endpoint, timestamp DESC);

GRANT ALL ON admin_api_metrics TO service_role;
GRANT ALL ON admin_api_metrics TO authenticated;

-- 3. admin_cache_metrics
-- Stores Redis cache hit/miss ratios and memory usage per collection interval.
CREATE TABLE IF NOT EXISTS admin_cache_metrics (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp          timestamptz NOT NULL    DEFAULT now(),
  hit_count          int         NOT NULL    DEFAULT 0,
  miss_count         int         NOT NULL    DEFAULT 0,
  hit_rate           real        NOT NULL    DEFAULT 0,
  eviction_count     int         NOT NULL    DEFAULT 0,
  memory_used_bytes  bigint      NOT NULL    DEFAULT 0,
  keys_count         int         NOT NULL    DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_admin_cache_metrics_timestamp
  ON admin_cache_metrics (timestamp DESC);

GRANT ALL ON admin_cache_metrics TO service_role;
GRANT ALL ON admin_cache_metrics TO authenticated;

-- 4. admin_alerts
-- Stores system alerts with severity levels; resolved_at is nullable to support open/closed state.
CREATE TABLE IF NOT EXISTS admin_alerts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type   text        NOT NULL,
  severity     text        NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
  message      text        NOT NULL,
  source       text        NOT NULL,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  resolved_at  timestamptz,
  acknowledged bool        NOT NULL DEFAULT false,
  metadata     jsonb
);

-- Partial index: efficiently query open (unresolved) alerts sorted by most recent.
CREATE INDEX IF NOT EXISTS idx_admin_alerts_open_triggered_at
  ON admin_alerts (triggered_at DESC)
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_admin_alerts_severity_triggered_at
  ON admin_alerts (severity, triggered_at DESC);

GRANT ALL ON admin_alerts TO service_role;
GRANT ALL ON admin_alerts TO authenticated;

-- 5. admin_score_snapshots
-- Stores PropertyIQ score validation metrics and pipeline status per score type.
CREATE TABLE IF NOT EXISTS admin_score_snapshots (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp          timestamptz NOT NULL    DEFAULT now(),
  score_type         text        NOT NULL,
  correlation_1y     real,
  hit_rate_1y        real,
  scores_validated   int         NOT NULL    DEFAULT 0,
  scores_pending     int         NOT NULL    DEFAULT 0,
  scores_failed      int         NOT NULL    DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_admin_score_snapshots_timestamp
  ON admin_score_snapshots (timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_admin_score_snapshots_score_type_timestamp
  ON admin_score_snapshots (score_type, timestamp DESC);

GRANT ALL ON admin_score_snapshots TO service_role;
GRANT ALL ON admin_score_snapshots TO authenticated;

-- 6. admin_user_snapshots
-- Stores user growth, tier distribution, and revenue metrics per collection interval.
CREATE TABLE IF NOT EXISTS admin_user_snapshots (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp           timestamptz NOT NULL    DEFAULT now(),
  total_users         int         NOT NULL    DEFAULT 0,
  new_signups         int         NOT NULL    DEFAULT 0,
  active_trials       int         NOT NULL    DEFAULT 0,
  expiring_soon       int         NOT NULL    DEFAULT 0,
  tier_free           int         NOT NULL    DEFAULT 0,
  tier_starter        int         NOT NULL    DEFAULT 0,
  tier_pro            int         NOT NULL    DEFAULT 0,
  tier_enterprise     int         NOT NULL    DEFAULT 0,
  paywall_views       int         NOT NULL    DEFAULT 0,
  conversions         int         NOT NULL    DEFAULT 0,
  mrr_cents           int         NOT NULL    DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_admin_user_snapshots_timestamp
  ON admin_user_snapshots (timestamp DESC);

GRANT ALL ON admin_user_snapshots TO service_role;
GRANT ALL ON admin_user_snapshots TO authenticated;

-- 7. admin_page_views
-- Stores per-page traffic metrics per collection interval.
CREATE TABLE IF NOT EXISTS admin_page_views (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp                timestamptz NOT NULL    DEFAULT now(),
  page_path                text        NOT NULL,
  view_count               int         NOT NULL    DEFAULT 0,
  unique_visitors          int         NOT NULL    DEFAULT 0,
  avg_session_duration_ms  int         NOT NULL    DEFAULT 0,
  bounce_rate              real        NOT NULL    DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_admin_page_views_timestamp
  ON admin_page_views (timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_admin_page_views_page_path_timestamp
  ON admin_page_views (page_path, timestamp DESC);

GRANT ALL ON admin_page_views TO service_role;
GRANT ALL ON admin_page_views TO authenticated;
