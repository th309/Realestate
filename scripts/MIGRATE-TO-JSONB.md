# Migration Guide: Convert to JSONB Attributes

## Overview
This migration converts the Zillow-specific `property_type` and `tier` columns to a flexible JSONB `attributes` column. This allows the schema to support all data sources (FRED, Census, BLS, HUD, Redfin) without schema changes.

## Why This Migration?

**Problem:** The current schema has Zillow-specific fields (`property_type`, `tier`) in the unique constraint, which causes issues for other data sources:
- FRED data has no property types
- Census demographics don't have tiers
- BLS employment data doesn't have these fields

**Solution:** Use JSONB `attributes` column to store source-specific fields flexibly.

## Migration Steps

### Step 1: Run the Migration Script

1. **Go to Supabase SQL Editor**
2. **Run `migrate-to-jsonb-attributes.sql`**

This will:
- ✅ Add `attributes JSONB` column
- ✅ Migrate existing Zillow data (property_type, tier → JSONB)
- ✅ Update unique constraint to use JSONB
- ✅ Create GIN index on JSONB for efficient queries
- ✅ Keep old columns temporarily (for safety)

### Step 2: Verify Migration

Check that data was migrated correctly:

```sql
-- Check migrated records
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN attributes != '{}'::jsonb THEN 1 END) as with_attributes,
  COUNT(CASE WHEN attributes->>'property_type' IS NOT NULL THEN 1 END) as with_property_type,
  COUNT(CASE WHEN attributes->>'tier' IS NOT NULL THEN 1 END) as with_tier
FROM market_time_series;

-- Sample migrated data
SELECT 
  region_id,
  date,
  metric_name,
  attributes
FROM market_time_series
WHERE data_source = 'zillow'
LIMIT 5;
```

Expected result:
- All Zillow records should have `attributes` with `property_type` and `tier`
- Other records (if any) should have empty `attributes: {}`

### Step 3: Test the Updated Importer

1. **The Zillow importer has been updated** to use JSONB attributes
2. **Test with a small import** (5-10 regions) to verify it works
3. **Check the data** to ensure attributes are stored correctly

### Step 4: Drop Old Columns (After Verification)

**⚠️ Only run this after verifying everything works!**

1. **Run `drop-old-zillow-columns.sql`** in Supabase SQL Editor
2. This will:
   - Verify all data is migrated
   - Drop `property_type` column
   - Drop `tier` column

## Data Structure After Migration

### Zillow Data
```json
{
  "region_id": "394913",
  "date": "2025-01-31",
  "metric_name": "zhvi",
  "metric_value": 691859.50,
  "data_source": "zillow",
  "attributes": {
    "property_type": "sfrcondo",
    "tier": "middle"
  }
}
```

### Future Data Sources
```json
// FRED (national mortgage rates)
{
  "region_id": "102001",
  "date": "2025-01-31",
  "metric_name": "mortgage_rate_30yr",
  "metric_value": 6.75,
  "data_source": "fred",
  "attributes": {
    "series_id": "MORTGAGE30US"
  }
}

// Census (demographics)
{
  "region_id": "394913",
  "date": "2024-01-01",
  "metric_name": "median_household_income",
  "metric_value": 75000,
  "data_source": "census",
  "attributes": {
    "survey_type": "acs_5yr",
    "year": 2024
  }
}
```

## Querying JSONB Attributes

### Get Zillow data with specific property type
```sql
SELECT * FROM market_time_series
WHERE data_source = 'zillow'
AND attributes->>'property_type' = 'sfrcondo';
```

### Get all metrics for a region
```sql
SELECT * FROM market_time_series
WHERE region_id = '394913'
ORDER BY date DESC;
```

### Get metrics by attribute value
```sql
SELECT * FROM market_time_series
WHERE attributes @> '{"tier": "middle"}'::jsonb;
```

## Rollback Plan

If something goes wrong:

1. **The old columns are still there** (property_type, tier)
2. **You can rollback** by:
   - Reverting the unique constraint
   - Copying data back from JSONB to columns
   - Dropping the attributes column

However, this should not be necessary as the migration is designed to be safe.

## Next Steps

After migration is complete:
1. ✅ Test Zillow import with new structure
2. ✅ Build FRED data source (will use empty attributes: {})
3. ✅ Build Census data source (will use custom attributes)
4. ✅ Build other data sources

## Questions?

If you encounter any issues:
1. Check the migration script output for errors
2. Verify data was migrated correctly using the verification queries
3. Test with a small import before running full imports

