-- Make the exactly-once signup conversion guard durable at the database layer.
--
-- WHY: signup_completed_at (migration 20260728210454) is what stops
-- conversion.signup_complete from firing twice for the same user. But RLS lets
-- a user UPDATE their own user_profiles row -- policy "Users can update own
-- profile", USING (auth.uid() = id), with no WITH CHECK and no column
-- restriction -- so a browser client could simply set the column back to NULL
-- and replay the conversion, re-firing the event plus its GA4 sign_up /
-- trial_start mirrors indefinitely. That pollutes conversion counts and any
-- ad-platform signal fed from them. Without this trigger the guarantee is
-- application-level convention only.
--
-- Pin the value rather than RAISE: a raised exception would turn a stray write
-- into a broken signup, and analytics integrity must never break auth.
-- Clamping is silent and total. The claim itself (NULL -> timestamp) is
-- unaffected because OLD.signup_completed_at is NULL in that case; every
-- later attempt to change or clear it becomes a no-op.
--
-- service_role bypasses so backend/admin data correction remains possible.
-- Note this means the postgres role is ALSO clamped: to correct a value by
-- hand, run as service_role or ALTER TABLE ... DISABLE TRIGGER first.

CREATE OR REPLACE FUNCTION public.enforce_signup_completed_at_write_once()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_user = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF OLD.signup_completed_at IS NOT NULL
     AND NEW.signup_completed_at IS DISTINCT FROM OLD.signup_completed_at THEN
    NEW.signup_completed_at := OLD.signup_completed_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_profiles_signup_completed_at_write_once
  ON public.user_profiles;

CREATE TRIGGER user_profiles_signup_completed_at_write_once
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_signup_completed_at_write_once();
