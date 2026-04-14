-- Migration: add_context_to_newsletter_signups
-- Purpose: Track which SEO conversion surface produced the signup so we can
-- measure landing-page-to-newsletter conversion per context (market vs blog).
-- Activation Funnel Initiative — April 2026.

ALTER TABLE public.newsletter_signups
  ADD COLUMN IF NOT EXISTS context text;
