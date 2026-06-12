-- Fix admin "delete user" failing + UI not refreshing.
--
-- Root cause: 15 foreign keys referencing auth.users(id) / user_profiles(id) were
-- declared ON DELETE NO ACTION. Deleting a user only worked if the backend's
-- hand-rolled, non-transactional cleanup (UsersService.deleteUser) perfectly cleared
-- every one first. Any cleanup step that silently warn-and-continued (missing GRANT,
-- ordering, a newly added table) left a referencing row, so the final
-- DELETE FROM auth.users threw a FK violation (23503) -> 400. The admin UI only
-- refetches on a 2xx, so the list also failed to auto-refresh.
--
-- Fix: push the delete-vs-nullify intent (already encoded in the service) down to the
-- schema. A single DELETE FROM auth.users now cascades atomically, and the behaviour
-- stays correct even if the backend cleanup list drifts from the schema.
--
--   CASCADE  -> user-owned rows are deleted with the user
--   SET NULL -> shared resources / audit trails are preserved, the user link is dropped
--
-- Idempotent (DROP CONSTRAINT IF EXISTS before re-adding). Verified against the live
-- schema in a rolled-back transaction before committing.

-- CASCADE: user-owned data
ALTER TABLE public.email_log          DROP CONSTRAINT IF EXISTS email_log_user_id_fkey,          ADD CONSTRAINT email_log_user_id_fkey          FOREIGN KEY (user_id)    REFERENCES auth.users(id)            ON DELETE CASCADE;
ALTER TABLE public.email_triggers     DROP CONSTRAINT IF EXISTS email_triggers_user_id_fkey,     ADD CONSTRAINT email_triggers_user_id_fkey     FOREIGN KEY (user_id)    REFERENCES auth.users(id)            ON DELETE CASCADE;
ALTER TABLE public.paywall_events     DROP CONSTRAINT IF EXISTS paywall_events_user_id_fkey,     ADD CONSTRAINT paywall_events_user_id_fkey     FOREIGN KEY (user_id)    REFERENCES auth.users(id)            ON DELETE CASCADE;
ALTER TABLE public.user_events        DROP CONSTRAINT IF EXISTS user_events_user_id_fkey,        ADD CONSTRAINT user_events_user_id_fkey        FOREIGN KEY (user_id)    REFERENCES auth.users(id)            ON DELETE CASCADE;
ALTER TABLE public.user_sessions      DROP CONSTRAINT IF EXISTS user_sessions_user_id_fkey,      ADD CONSTRAINT user_sessions_user_id_fkey      FOREIGN KEY (user_id)    REFERENCES auth.users(id)            ON DELETE CASCADE;
ALTER TABLE public.user_trials        DROP CONSTRAINT IF EXISTS user_trials_user_id_fkey,        ADD CONSTRAINT user_trials_user_id_fkey        FOREIGN KEY (user_id)    REFERENCES auth.users(id)            ON DELETE CASCADE;
ALTER TABLE public.visitor_identities DROP CONSTRAINT IF EXISTS visitor_identities_user_id_fkey, ADD CONSTRAINT visitor_identities_user_id_fkey FOREIGN KEY (user_id)    REFERENCES auth.users(id)            ON DELETE CASCADE;
ALTER TABLE public.report_templates   DROP CONSTRAINT IF EXISTS report_templates_created_by_fkey, ADD CONSTRAINT report_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

-- SET NULL: shared resources / audit trails
ALTER TABLE public.analytics_annotations     DROP CONSTRAINT IF EXISTS analytics_annotations_created_by_fkey,     ADD CONSTRAINT analytics_annotations_created_by_fkey     FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.funnel_definitions        DROP CONSTRAINT IF EXISTS funnel_definitions_created_by_fkey,        ADD CONSTRAINT funnel_definitions_created_by_fkey        FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.organization_api_keys     DROP CONSTRAINT IF EXISTS organization_api_keys_created_by_fkey,     ADD CONSTRAINT organization_api_keys_created_by_fkey     FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.organization_audit_log    DROP CONSTRAINT IF EXISTS organization_audit_log_actor_id_fkey,     ADD CONSTRAINT organization_audit_log_actor_id_fkey     FOREIGN KEY (actor_id)   REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.organization_embed_tokens DROP CONSTRAINT IF EXISTS organization_embed_tokens_created_by_fkey, ADD CONSTRAINT organization_embed_tokens_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.organization_invites      DROP CONSTRAINT IF EXISTS organization_invites_invited_by_fkey,     ADD CONSTRAINT organization_invites_invited_by_fkey      FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.trial_config              DROP CONSTRAINT IF EXISTS trial_config_updated_by_fkey,              ADD CONSTRAINT trial_config_updated_by_fkey              FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
