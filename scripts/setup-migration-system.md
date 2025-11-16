# Setup Migration System

## Step 1: Create the SQL Helper Function

Run this SQL in your **Supabase SQL Editor** (Dashboard → SQL Editor):

```sql
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
```

## Step 2: Verify Setup

After running the SQL above, verify the function was created by calling:

```
GET http://localhost:3000/api/migrate/verify
```

Or check in Supabase SQL Editor:

```sql
SELECT 
    routine_name,
    routine_type,
    security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'exec_sql';
```

## Step 3: Test the Migration System

Once verified, you can use the migration API to create indexes, tables, and modify schema programmatically.

Example: Create an index
```bash
POST http://localhost:3000/api/migrate
{
  "action": "create_index",
  "indexName": "test_index",
  "tableName": "test_table",
  "columns": ["column1", "column2"],
  "unique": false
}
```

