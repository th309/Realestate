-- Lead-magnet PDFs are not tied to a content_runs row (they're driven
-- by signup webhooks / admin trigger-test-magnet endpoint, not the
-- video pipeline). generate-lead-magnet.handler inserts with run_id=null
-- and the NOT NULL constraint was silently blocking every delivery.
--
-- Loosens the constraint so the lead-magnet flow can record its PDF
-- asset. Existing FK to content_runs(id) ON DELETE CASCADE stays —
-- video-run assets still cascade-delete with their parent run.

ALTER TABLE content_assets ALTER COLUMN run_id DROP NOT NULL;
