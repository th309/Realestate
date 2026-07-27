-- ============================================================================
-- Ensure the private `content-pipeline` Storage bucket exists.
-- ============================================================================
-- Post images (posts/<id>/<n>.png), rendered video/audio assets, run
-- thumbnails, metro hero images, and lead-magnet PDFs all upload here
-- server-side via the service_role key; reads are short-lived (1h) SIGNED URLs.
--
-- The bucket was originally provisioned out-of-band (it is live in the shared
-- project). This migration makes it reproducible in every environment so a
-- render never silently fails on a missing bucket (the render path is
-- best-effort and would otherwise leave drafts with no images and no obvious
-- cause). Private (public = false): access is signed-URL only. Uploads/deletes
-- run with the service_role key, so no client-side storage policies are needed.
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('content-pipeline', 'content-pipeline', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'content-pipeline') THEN
    RAISE NOTICE 'content-pipeline bucket ready (private, signed-URL only)';
  ELSE
    RAISE EXCEPTION 'Failed to ensure content-pipeline bucket';
  END IF;
END $$;
