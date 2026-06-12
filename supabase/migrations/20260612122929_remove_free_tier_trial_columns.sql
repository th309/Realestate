-- Remove the free-tier trial/expiration columns from user_profiles.
--
-- Context: handle_new_user() unconditionally stamped trial_started_at +
-- trial_ends_at (= NOW() + 14 days) on EVERY signup, so permanent free
-- accounts carried a meaningless "expiration date." Nothing reads these
-- columns: the canonical trial lives in user_trials (read by
-- TierResolverService + TrialExpirationCron) and Stripe trials live in
-- user_subscriptions.trial_ends_at. The user_profiles trial columns were a
-- write-only remnant of the abandoned reverse-trial and an indexed
-- mass-downgrade footgun. Product decision: free tier is permanent — no
-- trial, no expiration.
--
-- KEEP user_profiles.trial_expired_emitted_at: TrialExpirationCron uses it as
-- the once-per-user idempotency flag for user_trials expiry.

-- 1. Trigger no longer writes the trial columns (otherwise its INSERT would
--    fail post-drop and silently skip profile creation via its EXCEPTION
--    handler). Everything else about the trigger is preserved verbatim.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_profiles (
    id,
    email,
    full_name,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user failed for user %: % (SQLSTATE %)',
    NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$function$;

-- 2. Drop the dead columns. The two partial indexes that reference
--    trial_ends_at (idx_user_profiles_trial_ends_at,
--    idx_user_profiles_trial_expiration_queue) are dropped automatically by
--    Postgres when the column they depend on is removed.
ALTER TABLE public.user_profiles
  DROP COLUMN IF EXISTS trial_started_at,
  DROP COLUMN IF EXISTS trial_ends_at;
