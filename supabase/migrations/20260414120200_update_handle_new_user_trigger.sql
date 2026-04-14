-- Migration: update_handle_new_user_trigger
-- Purpose:
--   (1) Add EXCEPTION handler so future trigger failures log a WARNING instead of
--       silently dropping the profile (root-causes the troyhouston76 missing-profile
--       incident from 2026-04-13).
--   (2) Set trial_started_at and trial_ends_at on profile creation (14-day reverse trial
--       per the Apr 12 onboarding spec).
--
-- Preserves existing behavior:
--   - SECURITY DEFINER + search_path = 'public'
--   - COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)) fallback
--   - ON CONFLICT (id) DO NOTHING

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
    trial_started_at,
    trial_ends_at,
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
    NOW() + INTERVAL '14 days',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user failed for user %: % (SQLSTATE %)',
    NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;  -- Do not abort the auth.users insert
END;
$function$;
