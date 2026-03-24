-- Migration: Add targeted tier-change broadcast trigger
--
-- Replaces the existing broad user_profiles_realtime_broadcast trigger
-- (which fires on every INSERT/UPDATE/DELETE) with a focused trigger that
-- only broadcasts when subscription_tier actually changes.
--
-- The frontend hook useRealtimeTierSync.ts listens on broadcast channel
-- "user:{userId}:profile" for event "UPDATE" with payload shape:
--   { record: { subscription_tier, ... }, old_record: { subscription_tier, ... } }
--
-- This uses Supabase's built-in realtime.send() to insert into
-- realtime.messages, which the Realtime server picks up and delivers
-- to broadcast subscribers.

-- Step 1: Drop the existing overly-broad trigger (fires on ALL changes)
DROP TRIGGER IF EXISTS user_profiles_realtime_broadcast ON public.user_profiles;

-- Step 2: Replace the trigger function with a tier-change-specific version
CREATE OR REPLACE FUNCTION public.user_profiles_broadcast_trigger()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $function$
BEGIN
  -- Only broadcast when subscription_tier actually changes
  IF NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier THEN
    PERFORM realtime.send(
      jsonb_build_object(
        'old_record', jsonb_build_object(
          'id', OLD.id,
          'subscription_tier', OLD.subscription_tier,
          'email', OLD.email
        ),
        'record', jsonb_build_object(
          'id', NEW.id,
          'subscription_tier', NEW.subscription_tier,
          'email', NEW.email
        ),
        'operation', 'UPDATE',
        'table', TG_TABLE_NAME,
        'schema', TG_TABLE_SCHEMA
      ),
      'UPDATE',                                              -- event name
      'user:' || NEW.id::text || ':profile',                 -- topic (channel)
      true                                                   -- private channel
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- Step 3: Create the focused trigger — only fires on UPDATE, not INSERT/DELETE
-- Uses WHEN clause for an additional guard at the trigger level
CREATE TRIGGER user_profiles_tier_change_broadcast
  AFTER UPDATE ON public.user_profiles
  FOR EACH ROW
  WHEN (OLD.subscription_tier IS DISTINCT FROM NEW.subscription_tier)
  EXECUTE FUNCTION public.user_profiles_broadcast_trigger();

-- Step 4: Grant execute on the trigger function to relevant roles
GRANT EXECUTE ON FUNCTION public.user_profiles_broadcast_trigger() TO service_role;
GRANT EXECUTE ON FUNCTION public.user_profiles_broadcast_trigger() TO authenticated;
