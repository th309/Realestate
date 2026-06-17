-- Performance-advisor remediation (2026-06-16): follow-up to the security pass
-- (20260616171500..171503). Clears the actionable INFO-level PERFORMANCE advisors.
-- Applied live to prod via execute_sql on 2026-06-16; this file tracks it in git.
-- Every statement is idempotent so a future `supabase db push` is a no-op.
--
-- Scope decisions (the full advisor set was triaged, not blanket-applied):
--   * unindexed_foreign_keys (pgboss / pgboss_local): NOT touched. pg-boss owns and
--     recreates that schema; we never hand-index library-managed tables.
--   * unused_index (240 in public): LEFT IN PLACE. "0 scans" is measured since the last
--     stats reset, so a score backfill/failover can zero the counter on an index a rare
--     cron or cascade-delete still needs. 131 of them are unique/PK (enforce constraints).
--     Not worth the latent seq-scan risk to reclaim space.
--   * no_primary_key on backup_piq_scores_propertyiq_20260612: KEPT. It's the rollback
--     snapshot for the days-old score-pipeline unfreeze; a PK on a throwaway snapshot is
--     pointless, and we want the data until the new formula is confirmed-good.
--   * auth_db_connections_absolute: project Auth setting, not schema. Out of scope for a
--     migration; switch Auth to percentage-based allocation in the dashboard if/when the
--     instance is upsized.

-- ============ unindexed_foreign_keys: add covering indexes (public only) ============
-- Postgres does not auto-index FK columns. Without them every ON DELETE CASCADE / SET NULL
-- on the parent seq-scans the child table per row (and takes a heavier lock). All 23 tables
-- below are tiny (<=580 rows), so a plain CREATE INDEX locks for single-digit ms; CONCURRENTLY
-- would be wasted cost here.
CREATE INDEX IF NOT EXISTS idx_analytics_annotations_created_by          ON public.analytics_annotations (created_by);
CREATE INDEX IF NOT EXISTS idx_format_magnet_bindings_magnet_kind        ON public.format_magnet_bindings (magnet_kind);
CREATE INDEX IF NOT EXISTS idx_format_templates_default_tts_voice_id     ON public.format_templates (default_tts_voice_id);
CREATE INDEX IF NOT EXISTS idx_funnel_definitions_created_by             ON public.funnel_definitions (created_by);
CREATE INDEX IF NOT EXISTS idx_lead_magnet_deliveries_magnet_kind        ON public.lead_magnet_deliveries (magnet_kind);
CREATE INDEX IF NOT EXISTS idx_lead_magnet_deliveries_pdf_asset_id       ON public.lead_magnet_deliveries (pdf_asset_id);
CREATE INDEX IF NOT EXISTS idx_mcp_oauth_codes_client_id                 ON public.mcp_oauth_codes (client_id);
CREATE INDEX IF NOT EXISTS idx_mcp_oauth_tokens_client_id                ON public.mcp_oauth_tokens (client_id);
CREATE INDEX IF NOT EXISTS idx_organization_api_keys_created_by          ON public.organization_api_keys (created_by);
CREATE INDEX IF NOT EXISTS idx_organization_api_keys_organization_id     ON public.organization_api_keys (organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_audit_log_actor_id           ON public.organization_audit_log (actor_id);
CREATE INDEX IF NOT EXISTS idx_organization_embed_tokens_organization_id ON public.organization_embed_tokens (organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_embed_tokens_created_by      ON public.organization_embed_tokens (created_by);
CREATE INDEX IF NOT EXISTS idx_organization_invites_organization_id      ON public.organization_invites (organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_invites_invited_by           ON public.organization_invites (invited_by);
CREATE INDEX IF NOT EXISTS idx_organization_slug_redirects_organization_id ON public.organization_slug_redirects (organization_id);
CREATE INDEX IF NOT EXISTS idx_organizations_owner_id                    ON public.organizations (owner_id);
CREATE INDEX IF NOT EXISTS idx_platform_app_credentials_updated_by       ON public.platform_app_credentials (updated_by);
CREATE INDEX IF NOT EXISTS idx_platform_posts_short_link_id              ON public.platform_posts (short_link_id);
CREATE INDEX IF NOT EXISTS idx_platform_posts_run_id                     ON public.platform_posts (run_id);
CREATE INDEX IF NOT EXISTS idx_script_archetypes_source_cluster_id       ON public.script_archetypes (source_cluster_id);
CREATE INDEX IF NOT EXISTS idx_short_links_run_id                        ON public.short_links (run_id);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id                     ON public.user_api_keys (user_id);

-- ============ no_primary_key: drop 3 stale backup snapshots ============
-- Deliberate one-off snapshots whose source work has long shipped. Reclaims ~10 MB.
-- backup_piq_scores_propertyiq_20260612 is intentionally NOT dropped (see header).
DROP TABLE IF EXISTS public.backup_piq_scores_county_20260331;
DROP TABLE IF EXISTS public.backup_piq_scores_county_12mo_20260523;
DROP TABLE IF EXISTS public.backup_redfin_county_fips_20260523;
