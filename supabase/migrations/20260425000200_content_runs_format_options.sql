-- supabase/migrations/20260425000200_content_runs_format_options.sql
-- Adds format_options JSONB to content_runs so per-run render options
-- (e.g., score_mover windowDays/priorDate/windowLabel) can be persisted
-- alongside the run row. JSONB lets us extend without further migrations.
ALTER TABLE content_runs
  ADD COLUMN IF NOT EXISTS format_options JSONB NOT NULL DEFAULT '{}'::jsonb;
