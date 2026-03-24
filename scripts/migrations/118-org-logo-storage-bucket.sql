-- ============================================================================
-- Migration 118: Create Supabase Storage bucket for organization logos
-- ============================================================================
-- Part of Enterprise Features (Plan 2: Branding & Embeds)
--
-- Creates a public-read bucket for org logos. Logos appear on:
-- - Branded reports (in-app and shared links)
-- - Embeddable widgets (branding bar)
-- - Admin portal (branding preview)
--
-- Uploads and deletes are handled server-side via the NestJS backend
-- using the service_role key, so no client-side storage policies are needed.
-- ============================================================================

-- Create the bucket (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('org-logos', 'org-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Verify
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'org-logos') THEN
    RAISE NOTICE '✅ org-logos bucket ready';
  ELSE
    RAISE EXCEPTION 'Failed to create org-logos bucket';
  END IF;
END $$;
