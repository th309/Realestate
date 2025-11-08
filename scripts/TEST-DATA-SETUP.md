# Test Data Setup - Phase 1.4

## Overview
Insert 10 test markets into the database to verify everything works before loading all 120,000+ markets.

## What Gets Inserted

### Geographic Data (10 markets)
- **2 States:** California, Texas
- **5 Metros:** Los Angeles, Houston, Austin, Dallas, Boston
- **2 Cities:** Los Angeles, Houston
- **1 Zip Code:** Austin 78701

### Time Series Data
- 6 months of historical data for Austin metro (June-Nov 2024)
- Sample metrics: home values, growth rates, inventory, rents, etc.

### Investment Scores
- Complete score breakdown for Austin metro
- Home buyer score: 68.5
- Investor score: 72.0

## How to Run

### Option 1: Supabase SQL Editor (Recommended)
1. Go to Supabase dashboard → SQL Editor
2. Click "New query"
3. Copy entire contents of `insert-test-markets.sql`
4. Paste into SQL editor
5. Click "Run"
6. Verify success - should see verification query results

### Option 2: Command Line (if you have psql)
```bash
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres" -f scripts/insert-test-markets.sql
```

## Verification

After running, verify with:
```sql
-- Check geo_data
SELECT geo_type, COUNT(*) 
FROM geo_data 
GROUP BY geo_type;

-- Should show:
-- state: 2
-- metro: 5
-- city: 2
-- zipcode: 1

-- Check time series data
SELECT COUNT(*) FROM time_series_data;
-- Should show: 6 rows

-- Check scores
SELECT geo_code, geo_name, home_buyer_score, investor_score 
FROM current_scores 
JOIN geo_data USING (geo_code);
-- Should show: 1 row (Austin metro)
```

## Expected Results

After successful insert:
- ✅ 10 markets in `geo_data`
- ✅ 6 time series records
- ✅ 1 market with scores
- ✅ All queries work correctly

## Next Steps

After test data is loaded:
1. Test API endpoints with real data
2. Verify queries perform well
3. Test scoring calculations
4. Proceed to Phase 2: Data Pipeline

