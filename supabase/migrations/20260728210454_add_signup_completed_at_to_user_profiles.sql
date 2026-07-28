-- Exactly-once guard for the `conversion.signup_complete` analytics event.
--
-- WHY: /auth/callback decided "is this a first-time signup?" with a 60-second
-- wall-clock window against user_profiles.created_at. The real Google OAuth
-- flow -- consent screen + account chooser, then four serial awaits in
-- completeSignIn() -- routinely exceeds that. A measured production signup
-- (user 206a9531, 2026-06-18) took 155s from auth.users.created_at to its first
-- attributed event, so the window evaluated false and the conversion was
-- dropped. Result: `signup_complete` with method='oauth' has never fired once,
-- for any user, since the event shipped on 2026-06-12.
--
-- A durable per-user flag removes the race entirely: the callback CLAIMS the
-- conversion with `UPDATE ... WHERE signup_completed_at IS NULL`, which matches
-- exactly one writer no matter how slow the flow was or how many tabs race it.
--
-- BACKFILL IS REQUIRED. Every pre-existing profile would otherwise read as an
-- unfired signup and emit a spurious signup_complete the next time that user
-- passed through /auth/callback (OAuth sign-in, email confirm, or recovery).
-- Backfilling to created_at marks history as already-recorded without
-- fabricating any retroactive analytics events.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS signup_completed_at timestamptz;

COMMENT ON COLUMN public.user_profiles.signup_completed_at IS
  'Set once, at the moment conversion.signup_complete was emitted for this user. NULL = conversion not yet recorded. Claimed atomically via UPDATE ... WHERE signup_completed_at IS NULL; never reset.';

UPDATE public.user_profiles
   SET signup_completed_at = COALESCE(created_at, now())
 WHERE signup_completed_at IS NULL;
