# Geographic Normalization Import - Quick Start

## What This Does

Imports 223,614 rows of geographic data from 8 CSV files into your database to enable location normalization and search.

## Prerequisites Checklist

- ✅ Schema updated in Cursor (added columns to tiger_* tables)
- ✅ CSV files exist in `data/Normalization/` (8 files)
- ✅ Environment variables configured in `web/.env.local`

## Quick Start (3 Steps)

### Step 1: Install Dependencies

```bash
npm install csv-parse
```

### Step 2: Verify Schema is Ready

```bash
npx tsx scripts/verify-schema-ready.ts
```

**Expected output:**
```
✅ tiger_states.state_abbreviation
✅ tiger_states.population
✅ tiger_states.name_fragment
... (all columns pass)

✅ Schema verification PASSED
✨ Ready to run: npx tsx scripts/import-normalization-csvs.ts
```

If you see ❌, the schema migration didn't complete. Re-run it in Cursor.

### Step 3: Run the Import

```bash
npx tsx scripts/import-normalization-csvs.ts
```

**Progress output:**
```
🚀 Starting Geographic Normalization CSV Import
📍 Step 1: Importing States...
✅ States: 60/60 rows (1234ms)
🏙️  Step 2: Importing Metro Areas...
✅ Metro Areas: 936/936 rows (2345ms)
... (continues for all 6 steps)

📊 IMPORT SUMMARY
✅ States.csv: 60 rows
✅ Metro Areas.csv: 936 rows
✅ County to State.csv: 3,244 rows
✅ ZIP to State, Town, Metro.csv: 39,494 rows
✅ Zip to County.csv: 54,554 rows
✅ Metro to ZIP Code.csv: 35,988 rows

Total rows inserted: 134,276
Overall duration: 118.45s
✅ Import completed successfully!
```

## What Gets Imported

| Table | Rows | Data |
|-------|------|------|
| `tiger_states` | 60 | States with population |
| `tiger_cbsa` | 936 | Metro areas |
| `tiger_counties` | 3,244 | Counties |
| `tiger_zcta` | 39,494 | ZIP codes |
| `geo_zip_county` | 54,554 | ZIP→County relationships |
| `geo_zip_cbsa` | 35,988 | ZIP→Metro relationships |
| `geo_county_state` | 3,244 | County→State relationships |

## After Import

Test the normalization:

```sql
-- Find a ZIP code's full hierarchy
SELECT
  z.geoid as zip,
  z.default_city,
  z.default_state,
  c.name as county,
  s.name as state,
  cb.name as metro
FROM tiger_zcta z
LEFT JOIN geo_zip_county zc ON z.geoid = zc.zip_geoid AND zc.is_primary
LEFT JOIN tiger_counties c ON zc.county_geoid = c.geoid
LEFT JOIN geo_county_state cs ON c.geoid = cs.county_geoid
LEFT JOIN tiger_states s ON cs.state_geoid = s.geoid
LEFT JOIN geo_zip_cbsa zcb ON z.geoid = zcb.zip_geoid AND zcb.is_primary
LEFT JOIN tiger_cbsa cb ON zcb.cbsa_geoid = cb.geoid
WHERE z.geoid = '90210';
```

## Troubleshooting

**"Cannot find module 'csv-parse'"**
```bash
npm install csv-parse
```

**"Missing Supabase credentials"**
- Check `web/.env.local` has `SUPABASE_SERVICE_KEY`

**"Column does not exist"**
- Re-run schema migration in Cursor
- Run `npx tsx scripts/verify-schema-ready.ts` to confirm

**Import fails halfway**
- Safe to re-run - uses UPSERT, won't duplicate data
- Check network connection to Supabase

## Files Created

- `scripts/import-normalization-csvs.ts` - Main import script
- `scripts/verify-schema-ready.ts` - Schema verification
- `scripts/IMPORT-NORMALIZATION-README.md` - Detailed documentation

## Next Steps

After successful import, you can:

1. **Build location search** - Autocomplete for cities, ZIPs, metros
2. **Create hierarchical navigation** - State → County → ZIP browsing
3. **Normalize user input** - Convert "Los Angeles" to CBSA 31080
4. **Import demographics** (optional) - `ZIP Code Demographics.csv` has 200+ fields

---

**Estimated Time:** ~2 minutes
**Total Data:** 134,276 rows across 7 tables
