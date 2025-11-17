-- Migration: Grant UPDATE permissions on tiger tables
-- Purpose: Allow updates to FRED series ID columns
-- Date: 2024-12-19

-- Grant UPDATE permissions to service_role
GRANT UPDATE ON TABLE tiger_cbsa TO service_role;
GRANT UPDATE ON TABLE tiger_counties TO service_role;

-- Also grant to authenticated users (for manual updates if needed)
GRANT UPDATE ON TABLE tiger_cbsa TO authenticated;
GRANT UPDATE ON TABLE tiger_counties TO authenticated;

