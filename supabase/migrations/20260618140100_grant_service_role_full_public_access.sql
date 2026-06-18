-- Give the privileged backend role (service_role — the role the secret API key
-- maps to) COMPLETE access to the public schema.
--
-- Several tables were created without the standard service_role grant
-- (email_log, email_preferences, user_feature_usage, alert_history,
-- partner_config, backtest_*, census_division_mapping), so PostgREST returned
-- "permission denied for table ..." for the secret key. service_role is the
-- server-only, RLS-bypassing role; it is never exposed to clients, so full
-- access is its intended posture.
--
-- This grants all existing tables/sequences/functions (error-tolerant so it
-- skips objects owned by extensions, e.g. PostGIS spatial_ref_sys) and sets
-- default privileges so future objects are covered automatically.

GRANT USAGE ON SCHEMA public TO service_role;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    BEGIN
      EXECUTE format('GRANT ALL ON public.%I TO service_role', r.tablename);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'skip table %: %', r.tablename, SQLERRM;
    END;
  END LOOP;
  FOR r IN SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public' LOOP
    BEGIN
      EXECUTE format('GRANT ALL ON SEQUENCE public.%I TO service_role', r.sequence_name);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'skip sequence %: %', r.sequence_name, SQLERRM;
    END;
  END LOOP;
END $$;

-- Future objects created by the migration role auto-grant service_role.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
