# Deploy New Schema to Supabase

## Step 1: Backup Existing Data (if any)
If you have existing data in the old tables, export it first.

## Step 2: Deploy New Schema

1. Go to Supabase Dashboard: https://app.supabase.com
2. Select your project
3. Navigate to **SQL Editor** (left sidebar)
4. Click **New Query**
5. Copy the entire contents of `scripts/database-schema-v2.sql`
6. Paste into the SQL editor
7. Click **Run** (or press Ctrl+Enter)

## Step 3: Verify Tables Created

Run this query to verify all tables exist:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

Expected tables:
- admin_users
- ai_cache
- current_scores
- data_ingestion_logs
- market_metadata
- market_time_series (and partitions)
- markets
- price_alerts
- tier_configs
- user_activity_logs
- user_favorites
- user_subscriptions

## Step 4: Verify PostGIS Extension
```sql
SELECT * FROM pg_extension WHERE extname = 'postgis';
```

## Step 5: Check Initial Data
```sql
-- Check subscription tiers
SELECT * FROM tier_configs;

-- Should see: free, pro, api, enterprise tiers
```

## Step 6: Test RLS Policies
```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND rowsecurity = true;
```

## Troubleshooting

If you get errors:
- **"relation already exists"**: The old tables exist. Either drop them first or use the schema as-is.
- **"extension postgis does not exist"**: Enable PostGIS in Supabase Dashboard > Database > Extensions
- **Permission errors**: Make sure you're using the SQL Editor in Supabase Dashboard

## Success Indicators
✅ All tables created without errors
✅ PostGIS extension enabled
✅ Tier configs populated
✅ RLS policies active on user tables
