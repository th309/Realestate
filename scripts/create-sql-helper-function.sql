-- Create helper function to execute SQL from migrations
-- Run this ONCE in Supabase SQL Editor to enable programmatic schema changes

CREATE OR REPLACE FUNCTION exec_sql(query text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE query;
END;
$$;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION exec_sql(text) TO service_role;

-- Test the function (optional)
-- SELECT exec_sql('SELECT 1');


