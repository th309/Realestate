-- Tracks the latest PropertyIQ score period that has been pushed to the SEO
-- market pages via on-demand revalidation. Singleton row (id = 1): the daily
-- SeoRevalidationService cron compares MAX(propertyiq_scores.score_date) to
-- last_score_date and only triggers a frontend revalidation when a new period
-- has landed.
CREATE TABLE IF NOT EXISTS public.seo_revalidation_state (
  id integer PRIMARY KEY DEFAULT 1,
  last_score_date date,
  revalidated_at timestamptz DEFAULT now(),
  CONSTRAINT seo_revalidation_state_singleton CHECK (id = 1)
);

-- Backend-internal table: only the SeoRevalidationService cron (service_role)
-- reads/writes it. No client (anon/authenticated) ever touches it, so it gets
-- no `authenticated` grant.
GRANT ALL ON public.seo_revalidation_state TO service_role;
-- Defense in depth: RLS on with zero policies denies anon/authenticated entirely;
-- service_role bypasses RLS, so the cron is unaffected.
ALTER TABLE public.seo_revalidation_state ENABLE ROW LEVEL SECURITY;
