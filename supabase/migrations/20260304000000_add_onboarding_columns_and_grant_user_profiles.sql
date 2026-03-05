-- Add onboarding columns to user_profiles for the first-time user tutorial system.
-- These columns store wizard preferences and tour completion state.
-- The GRANT enables the frontend (authenticated role) to read/write onboarding state
-- directly via Supabase browser client, bypassing the NestJS backend.

-- Add onboarding columns (idempotent via IF NOT EXISTS)
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS user_type text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS investment_goal text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS experience_level text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS preferred_markets jsonb DEFAULT NULL;

-- Grant authenticated role access to user_profiles.
-- Previously only service_role (NestJS backend) had access.
-- The onboarding fetchers use the Supabase browser client which
-- authenticates as the 'authenticated' role.
GRANT SELECT, UPDATE ON public.user_profiles TO authenticated;

-- RLS policies (idempotent via IF NOT EXISTS equivalent using DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_profiles'
      AND policyname = 'Users can read own profile'
  ) THEN
    CREATE POLICY "Users can read own profile"
      ON public.user_profiles FOR SELECT
      USING (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_profiles'
      AND policyname = 'Users can update own profile'
  ) THEN
    CREATE POLICY "Users can update own profile"
      ON public.user_profiles FOR UPDATE
      USING (auth.uid() = id);
  END IF;
END
$$;
