# Geographic Normalization CSV Import

This script imports 8 CSV files containing geographic normalization data into your Supabase database.

## Prerequisites

✅ Schema columns added to database (completed via Cursor)
✅ CSV files in `data/Normalization/` directory (8 files, ~223K rows total)
✅ Environment variables configured in `web/.env.local`

## What Gets Imported

| Step | File | Target Table | Rows | Description |
|------|------|-------------|------|-------------|
| 1 | States.csv | `tiger_states` | 60 | State definitions + population |
| 2 | Metro Areas.csv | `tiger_cbsa` | 936 | Metro area definitions |
| 3 | County to State.csv | `tiger_counties` + `geo_county_state` | 3,244 | Counties + state relationships |
| 4 | ZIP to State, Town, Metro.csv | `tiger_zcta` | 39,494 | ZIP code attributes |
| 5 | Zip to County.csv | `geo_zip_county` | 54,554 | ZIP → County relationships |
| 6 | Metro to ZIP Code.csv | `geo_zip_cbsa` | 35,988 | Metro → ZIP relationships |

**Total: ~134,276 rows across 6 tables**

## How to Run

### Step 1: Install Dependencies

```bash
cd /home/user/Realestate
npm install csv-parse
```

### Step 2: Set Environment Variables

Ensure `web/.env.local` has:
```env
NEXT_PUBLIC_SUPABASE_URL=https://pysflbhpnqwoczyuaaif.supabase.co
SUPABASE_SERVICE_KEY=your_service_key
```

### Step 3: Run the Import

```bash
# From the root directory
npx tsx scripts/import-normalization-csvs.ts
```

### Step 4: Monitor Progress

The script will output progress for each step:
```
🚀 Starting Geographic Normalization CSV Import
📍 Step 1: Importing States...
✅ States: 60/60 rows (1234ms)

🏙️  Step 2: Importing Metro Areas...
✅ Metro Areas: 936/936 rows (2345ms)
...
```

## What Happens During Import

### Data Transformations

1. **FIPS Code Normalization**
   - State FIPS: 2 digits (`01`, `02`)
   - County FIPS: 5 digits (`01001`, `17031`)
   - CBSA Code: 5 digits (`35620`, `16980`)

2. **County Name Cleaning**
   - Removes " County" suffix
   - `"Cook County"` → `"Cook"`

3. **LSAD Conversion**
   - `"Metropolitan Statistical Area"` → `"M1"`
   - `"Micropolitan Statistical Area"` → `"M2"`

4. **Primary Relationship Detection**
   - ZIP-County: `is_primary = true` if overlap ≥ 50%
   - ZIP-Metro: `is_primary = true` if overlap ≥ 1%

### Batch Processing

Large files are processed in batches of 1,000 rows to avoid memory issues:
- ZIP-County: 54,554 rows → 55 batches
- ZIP-Metro: 35,988 rows → 36 batches

### Conflict Resolution

All imports use `UPSERT` with conflict resolution:
- Existing records are updated
- No duplicate errors
- Safe to re-run if import fails

## Verification

After import completes, verify the data:

```sql
-- Check row counts
SELECT 'tiger_states' as table, COUNT(*) as rows FROM tiger_states
UNION ALL
SELECT 'tiger_cbsa', COUNT(*) FROM tiger_cbsa
UNION ALL
SELECT 'tiger_counties', COUNT(*) FROM tiger_counties
UNION ALL
SELECT 'tiger_zcta', COUNT(*) FROM tiger_zcta
UNION ALL
SELECT 'geo_zip_county', COUNT(*) FROM geo_zip_county
UNION ALL
SELECT 'geo_zip_cbsa', COUNT(*) FROM geo_zip_cbsa;

-- Expected results:
-- tiger_states: 60
-- tiger_cbsa: 936
-- tiger_counties: 3,244
-- tiger_zcta: 39,494
-- geo_zip_county: 54,554
-- geo_zip_cbsa: 35,988

-- Check population data was loaded
SELECT name, population FROM tiger_states WHERE population IS NOT NULL LIMIT 5;
SELECT name, population FROM tiger_cbsa WHERE population IS NOT NULL LIMIT 5;

-- Check relationships
SELECT z.geoid, c.name as county, s.name as state
FROM tiger_zcta z
JOIN geo_zip_county zc ON z.geoid = zc.zip_geoid AND zc.is_primary = true
JOIN tiger_counties c ON zc.county_geoid = c.geoid
JOIN geo_county_state cs ON c.geoid = cs.county_geoid
JOIN tiger_states s ON cs.state_geoid = s.geoid
LIMIT 10;
```

## Troubleshooting

### Error: "Cannot find module 'csv-parse'"
```bash
npm install csv-parse
```

### Error: "Missing Supabase credentials"
Check `web/.env.local` has `SUPABASE_SERVICE_KEY`

### Error: "Column does not exist"
Re-run the schema migration from Cursor

### Import hangs or times out
- Check network connection to Supabase
- Try reducing `BATCH_SIZE` in the script (line 19)
- Run individual import functions separately

### Partial import completed
The script is safe to re-run. It will update existing records and continue from where it left off.

## Next Steps

After successful import:

1. **Test Geographic Normalization**
   ```typescript
   import { normalizeGeography } from '@/lib/geo/normalize'

   const result = await normalizeGeography('90210')
   // Returns: ZIP → County → State → Metro relationships
   ```

2. **Build Search Functions**
   - Autocomplete for locations
   - Fuzzy matching for city names
   - Hierarchical browsing (State → County → ZIP)

3. **Import ZIP Demographics** (optional)
   - `ZIP Code Demographics.csv` has 200+ demographic fields
   - Can be imported to `census_demographics` table
   - ~33K rows

## Performance

Expected import time on typical connection:
- States: ~1 second
- Metro Areas: ~2 seconds
- Counties: ~5 seconds
- ZIP Codes: ~10 seconds
- ZIP-County: ~60 seconds (54K rows)
- ZIP-Metro: ~40 seconds (36K rows)

**Total: ~2 minutes**

## Support

If you encounter issues:
1. Check the error output from the script
2. Verify CSV files exist in `data/Normalization/`
3. Confirm database schema has new columns
4. Test Supabase connection with a simple query

---

**Created:** 2025-11-16
**Author:** Claude
**Script:** `scripts/import-normalization-csvs.ts`
