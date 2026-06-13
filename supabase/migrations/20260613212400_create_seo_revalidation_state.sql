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

-- Without these GRANTs even sb_secret_/service_role keys hit permission-denied.
GRANT ALL ON public.seo_revalidation_state TO service_role;
GRANT ALL ON public.seo_revalidation_state TO authenticated;
