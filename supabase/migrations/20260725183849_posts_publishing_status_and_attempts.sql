-- Phase 5 (automated publishing): add the in-flight claim status + retry counter.
--
-- The scheduled-post scanner claims a due post by an atomic status flip
-- 'scheduled' -> 'publishing' BEFORE calling any external API, so a concurrent
-- cron tick (or a second instance) can't double-post. A crash while 'publishing'
-- is recovered by an age-based rescan that re-attempts with the SAME Late
-- x-request-id (content-hash dedupe closes the crashed-after-accept gap).
--
-- `attempts` bounds the retry: each claim/re-claim increments it; past the cap
-- the post is moved to 'failed' (surfaces as a Needs-attention feed card).
--
-- Additive + idempotent. Depends on 20260725171557 (posts table). No new GRANTs:
-- the table already has GRANT ALL to service_role + authenticated, which covers
-- the new column; the CHECK swap changes no privileges.

-- Add 'publishing' to the status CHECK (inline constraint auto-named posts_status_check).
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_status_check;
ALTER TABLE posts
  ADD CONSTRAINT posts_status_check
  CHECK (
    status IN (
      'draft',
      'pending_review',
      'approved',
      'scheduled',
      'publishing',
      'published',
      'failed',
      'skipped'
    )
  );

-- Retry attempt counter for the publish scanner's bounded retry.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;

-- Partial index for the stuck-'publishing' recovery scan (age-based rescan).
CREATE INDEX IF NOT EXISTS idx_posts_publishing_updated
  ON posts (updated_at)
  WHERE status = 'publishing';
