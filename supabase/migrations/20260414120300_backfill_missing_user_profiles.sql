-- Migration: backfill_missing_user_profiles
-- Purpose: One-time fix for users who created auth.users rows but whose handle_new_user
-- trigger failed silently (at least troyhouston76@gmail.com per investigation 2026-04-14).
-- Also populates trial columns for any backfilled profiles so they get the same 14-day
-- reverse trial as new signups.
--
-- Verified 2026-04-14 before apply: exactly 1 orphan (troyhouston76@gmail.com).

INSERT INTO public.user_profiles (id, email, full_name, created_at, updated_at, trial_started_at, trial_ends_at)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)),
  au.created_at,
  NOW(),
  au.created_at,
  au.created_at + INTERVAL '14 days'
FROM auth.users au
WHERE au.id NOT IN (SELECT id FROM public.user_profiles)
ON CONFLICT (id) DO NOTHING;
