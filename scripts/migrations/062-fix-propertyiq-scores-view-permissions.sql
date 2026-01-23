-- Migration 062: Fix PropertyIQ Scores View Permissions
--
-- Migration 061 created propertyiq_scores as a VIEW with an INSTEAD OF INSERT trigger,
-- but only granted SELECT permission. This prevents inserts even though the trigger
-- would handle them by inserting into propertyiq_scores_v2.
--
-- This migration grants INSERT permission on the view so the trigger can fire.

-- Grant INSERT on the view to allow the INSTEAD OF INSERT trigger to work
GRANT INSERT ON propertyiq_scores TO service_role;
GRANT INSERT ON propertyiq_scores TO authenticated;

-- Also ensure the trigger function has proper security
ALTER FUNCTION propertyiq_scores_insert_trigger() SECURITY DEFINER;

-- Verify the setup
DO $$
BEGIN
    RAISE NOTICE 'Migration 062 complete: INSERT permission granted on propertyiq_scores view';
END $$;
