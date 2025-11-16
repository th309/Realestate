# Data Importers

Automated data import scripts for Census, FRED, BLS, Zillow, and Redfin.

## Census Bureau API Importer

**Status:** ✅ Ready to use
**API Key:** Already configured in `.env.local`
**Update Frequency:** Annual (December)
**Cost:** Free

### Quick Start

```bash
# Import latest available year for ZIPs (recommended)
npx tsx scripts/importers/census-api-importer.ts --year=2022 --geography=zip

# Import all geographies (state, county, zip)
npx tsx scripts/importers/census-api-importer.ts --year=2022 --all
```

### What It Imports

**Demographics Table:** `census_demographics`
- Total population
- Median age
- Total households
- Age distributions (under 18, 18-34, 35-54, 65+)
- Education levels (bachelor's, graduate degrees)

**Economics Table:** `census_economics`
- Median household income
- Per capita income
- Poverty rate
- Unemployment rate
- Gini index (income inequality)

**Housing Table:** `census_housing`
- Total housing units
- Occupied units
- Vacancy rate
- Homeownership rate
- Median home value
- Median gross rent
- Median year built

### Data Coverage

| Geography | Records | Tables | Estimated Time |
|-----------|---------|--------|---------------|
| **ZIP** | ~33,000 | 3 | ~45 minutes |
| **County** | ~3,244 | 3 | ~5 minutes |
| **State** | ~52 | 3 | ~30 seconds |
| **ALL** | ~36,000 | 3 | ~50 minutes |

### Available Years

Census releases ACS 5-Year data annually with a 2-year lag:
- **2024 Release** → 2022 data (available now)
- **2025 Release** → 2023 data (December 2025)
- **2026 Release** → 2024 data (December 2026)

### Usage Examples

```bash
# Import 2022 ZIP codes (most common use case)
npx tsx scripts/importers/census-api-importer.ts --year=2022 --geography=zip

# Import 2022 counties
npx tsx scripts/importers/census-api-importer.ts --year=2022 --geography=county

# Import 2022 states
npx tsx scripts/importers/census-api-importer.ts --year=2022 --geography=state

# Import all 2022 data (states, counties, ZIPs)
npx tsx scripts/importers/census-api-importer.ts --year=2022 --all

# Import historical data (2021)
npx tsx scripts/importers/census-api-importer.ts --year=2021 --geography=zip
```

### Output Example

```
📊 Importing Census 2022 Data - ZIP
==========================================================
✅ Fetched 33,791 records from Census API
   Processed 100/33791 records...
   Processed 200/33791 records...
   ...
   Processed 33791/33791 records...

==========================================================
📊 IMPORT COMPLETE
==========================================================
Geography: zip
Year: 2022
Total Records: 33,791
Demographics: 33,791
Economics: 33,791
Housing: 33,791
Errors: 0
Duration: 2847.45s (~47 minutes)
==========================================================
```

### Error Handling

The importer handles:
- Missing/null values (Census uses -666666666 for N/A)
- Network errors (automatic retry not implemented yet)
- Duplicate records (upserts based on geoid + year)
- Batch processing (100 records per batch)

### Variables Pulled

Full list of Census variables:

**Demographics:**
- B01001_001E - Total Population
- B01002_001E - Median Age
- B11001_001E - Total Households
- B25010_001E - Average Household Size
- B01001_003E through B01001_044E - Age breakdowns
- B15003_022E through B15003_025E - Education levels

**Economics:**
- B19013_001E - Median Household Income
- B19301_001E - Per Capita Income
- B17001_002E - Population Below Poverty
- B23025_005E - Unemployed Population
- B23025_003E - Labor Force
- B19083_001E - Gini Index

**Housing:**
- B25001_001E - Total Housing Units
- B25002_002E - Occupied Housing Units
- B25003_002E - Owner Occupied
- B25077_001E - Median Home Value
- B25064_001E - Median Gross Rent
- B25035_001E - Median Year Built

### Troubleshooting

**"Census API error: 400"**
- Check that the year is valid (2009-2022 available)
- Verify API key is correct

**"Census API error: 429 - Rate limit exceeded"**
- Wait a few minutes and retry
- Census API has generous rate limits, this is rare

**"Missing CENSUS_API_KEY"**
- Ensure `web/.env.local` has `CENSUS_API_KEY=your_key`
- Verify you're running from project root

**"Batch insert failed"**
- Check Supabase connection
- Verify tables exist with correct columns
- Check database logs in Supabase dashboard

### Automation Schedule

Recommended schedule:
- **When:** January 15th each year (after December release)
- **How:** Cron job or GitHub Actions
- **Command:** `npx tsx scripts/importers/census-api-importer.ts --year=YYYY --all`

### Data Freshness

Check when new Census data is available:

```sql
-- Check latest year in database
SELECT
  'demographics' as table,
  MAX(vintage_year) as latest_year,
  COUNT(DISTINCT geoid) as geographies
FROM census_demographics
UNION ALL
SELECT 'economics', MAX(vintage_year), COUNT(DISTINCT geoid)
FROM census_economics
UNION ALL
SELECT 'housing', MAX(vintage_year), COUNT(DISTINCT geoid)
FROM census_housing;
```

### Next Steps

After importing Census data:

1. **Validate Import:**
   ```bash
   npx tsx scripts/validate-geo-import.ts
   ```

2. **Query Example:**
   ```sql
   SELECT
     z.geoid,
     z.default_city,
     d.total_population,
     d.median_age,
     e.median_household_income,
     h.median_home_value
   FROM tiger_zcta z
   JOIN census_demographics d ON z.geoid = d.geoid AND d.vintage_year = 2022
   JOIN census_economics e ON z.geoid = e.geoid AND e.vintage_year = 2022
   JOIN census_housing h ON z.geoid = h.geoid AND h.vintage_year = 2022
   WHERE z.default_state = 'CA'
   LIMIT 10;
   ```

3. **Build Features:**
   - Population density maps
   - Income vs home value correlation
   - Demographic filtering for market search
   - Investment scoring based on demographics

---

## Coming Soon

- **FRED API Importer** - Economic indicators (unemployment, GDP)
- **BLS API Importer** - Employment data
- **Zillow File Watcher** - Auto-import Zillow CSVs
- **Redfin File Watcher** - Auto-import Redfin CSVs

---

**Last Updated:** 2025-11-16
