-- Migration 047: Grant calculated_metrics permissions to service_role
-- The service_role needs explicit permissions to INSERT/UPDATE

BEGIN;

-- Grant full permissions on calculated_metrics to service_role
GRANT ALL ON calculated_metrics TO service_role;

-- Also grant to postgres role (which service key may use)
GRANT ALL ON calculated_metrics TO postgres;

-- Verify RLS allows service_role (service_role should bypass RLS by default, but be explicit)
ALTER TABLE calculated_metrics ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows service_role to do everything
DROP POLICY IF EXISTS "service_role_all" ON calculated_metrics;
CREATE POLICY "service_role_all" ON calculated_metrics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Also ensure authenticated users have proper access
DROP POLICY IF EXISTS "authenticated_read_write" ON calculated_metrics;
CREATE POLICY "authenticated_read_write" ON calculated_metrics
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMIT;

DO $$
BEGIN
    RAISE NOTICE 'Migration 047 completed: Granted calculated_metrics permissions to service_role';
END $$;
