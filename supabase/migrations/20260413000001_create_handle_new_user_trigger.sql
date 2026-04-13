-- Migration: Auto-create user_profiles row on signup
--
-- Root cause: No database trigger existed to create user_profiles rows when
-- new users sign up via auth.users. Email+autoconfirm signups bypassed the
-- auth callback (which was the only code path that created profiles via UPSERT).
-- Result: users could log in but were invisible to the admin panel and lacked
-- profile data for entitlements, drip emails, etc.
--
-- This migration:
-- 1. Creates a handle_new_user trigger on auth.users (standard Supabase pattern)
-- 2. Grants INSERT on user_profiles to authenticated role (was missing)
-- 3. Adds INSERT RLS policy so users can create their own profile row
-- 4. Backfills any auth.users that are missing user_profiles rows

-- 1. Drop stale trigger (existed but function body was outdated/broken)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Trigger function: auto-create user_profiles on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, created_at, updated_at)
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
END;
$$;

-- 3. Recreate the trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4. Grant INSERT to authenticated role (SELECT + UPDATE already granted)
GRANT INSERT ON public.user_profiles TO authenticated;

-- 5. Add INSERT RLS policy (users can only insert their own profile row)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_profiles'
      AND policyname = 'Users can insert own profile'
  ) THEN
    CREATE POLICY "Users can insert own profile"
      ON public.user_profiles FOR INSERT
      WITH CHECK (auth.uid() = id);
  END IF;
END
$$;

-- 6. Backfill: create user_profiles for any auth.users missing them
INSERT INTO public.user_profiles (id, email, full_name, created_at, updated_at)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  u.created_at,
  NOW()
FROM auth.users u
LEFT JOIN public.user_profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
