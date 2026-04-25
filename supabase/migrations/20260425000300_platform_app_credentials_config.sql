-- Per-platform settings stored alongside app credentials. Currently used
-- by LinkedIn for { authorMode: 'member' | 'organization' } but typed as
-- JSONB so future per-platform toggles (TikTok account variants,
-- Meta page selection, etc.) don't each need their own migration.
--
-- Resolution order in PlatformAppCredentialsService:
--   DB config field > env var > built-in default
--
-- Idempotent (IF NOT EXISTS), safe to re-run.

ALTER TABLE platform_app_credentials
  ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}';
