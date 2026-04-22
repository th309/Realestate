-- Migration: grant_newsletter_signups
-- Purpose: Fix permission denied on /api/newsletter. The newsletter_signups table
-- was created without grants to service_role / authenticated, so the supabase admin
-- client (using sb_secret_ key) gets RLS-denied on every upsert. Discovered during
-- Activation Funnel E2E verification — the endpoint had been 500'ing silently for
-- all callers.

GRANT ALL ON public.newsletter_signups TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.newsletter_signups TO authenticated;
