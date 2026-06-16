-- Make handle_new_user create the user_trials row that the tier-resolver reads,
-- so a brand-new signup resolves to its Pro trial BEFORE first render (no
-- paywall-blurred "free" flash on the Score / map metrics / report).
--
-- Why this is needed: TierResolverService.resolve() (entitlements) only reads the
-- user_trials table; the row was previously created lazily by a best-effort
-- client `startOnboardingTrial()` fetch AFTER navigation. Until that landed the
-- user resolved to `free`. This trigger now inserts the row atomically at signup,
-- gated on trial_config.is_enabled, inside the existing EXCEPTION guard so it can
-- never block the auth.users insert. (The client startOnboardingTrial() call stays
-- as an idempotent fallback — ON CONFLICT (user_id) DO NOTHING makes both safe.)
--
-- DEVIATION FROM PLAN (2026-06-16-trial-unblur.md, Task 2): the plan's body
-- re-introduced INSERT INTO user_profiles (... trial_started_at, trial_ends_at ...),
-- but migration 20260612122929_remove_free_tier_trial_columns.sql DROPPED those two
-- columns (free tier is now permanent) and rewrote handle_new_user to omit them.
-- Porting the plan verbatim would make the user_profiles INSERT fail post-drop,
-- get swallowed by the EXCEPTION handler, and silently skip profile creation — the
-- exact footgun that earlier migration warns about. So this is based on the CURRENT
-- (20260612122929) definition and adds ONLY the user_trials insert.
--
-- Preserves existing behavior verbatim:
--   - SECURITY DEFINER + search_path = 'public'
--   - COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)) fallback
--   - ON CONFLICT (id) DO NOTHING on user_profiles
--   - EXCEPTION WHEN OTHERS -> RAISE WARNING + RETURN NEW (never aborts auth.users)

CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  cfg trial_config%ROWTYPE;
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

  -- Reverse Pro trial: insert the user_trials row the tier-resolver queries, so the
  -- very first authenticated render resolves to the trial tier instead of free.
  SELECT * INTO cfg FROM trial_config LIMIT 1;
  IF cfg.is_enabled THEN
    INSERT INTO public.user_trials (user_id, tier, expires_at)
    VALUES (
      NEW.id,
      COALESCE(cfg.trial_tier, 'pro'),
      NOW() + (INTERVAL '1 day' * COALESCE(cfg.duration_days, 14))
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user failed for user %: % (SQLSTATE %)',
    NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;  -- never abort the auth.users insert
END;
$function$;
