# MSA and County FRED Series ID Population Guide

## Overview

This guide explains how to populate FRED series IDs for MSA (Metropolitan Statistical Area) and County levels. Unlike state-level series IDs which follow consistent patterns, MSA and County series IDs are more variable and require a combination of pattern-based population and API discovery.

## Current Status

### ✅ Completed
- **State Level**: All 5 fields populated (unemployment_rate, employment_total, median_household_income, gdp, housing_permits)
- **MSA GDP**: Pattern-based population working (`NGMP{CBSA_CODE}`)
- **Infrastructure**: Discovery scripts, population scripts, and helper functions created

### ⏳ In Progress
- **MSA Other Fields**: Unemployment, Employment, Income, Housing Permits require API discovery
- **County All Fields**: All fields require API discovery due to inconsistent patterns

## FRED Series ID Patterns

### MSA Level Patterns

1. **GDP** ✅ (Consistent Pattern)
   - Pattern: `NGMP{CBSA_CODE}`
   - Example: `NGMP31080` = Los Angeles-Long Beach-Anaheim, CA MSA
   - Status: **Working** - Can be auto-populated

2. **Unemployment Rate** ⚠️ (Variable Pattern)
   - Patterns observed:
     - `{MSA_ABBREV}{CODE}UR` (e.g., `LOSA106UR` for Los Angeles)
     - `{MSA_ABBREV}{CODE}URN` (e.g., `AKRO439URN` for Akron)
   - Status: **Requires API discovery** - Pattern varies by MSA

3. **Employment Total** ⚠️ (Variable Pattern)
   - Patterns observed:
     - `{MSA_ABBREV}{CODE}NA` (e.g., `ABIL148NA` for Abilene)
     - `SMS{CBSA_CODE}...` (e.g., `SMS36935610000000001` for New York)
   - Status: **Requires API discovery** - Pattern varies significantly

4. **Median Household Income** ❌
   - Status: **Rarely available** - Most MSAs don't have this data in FRED

5. **Housing Permits** ⚠️ (Variable Pattern)
   - Patterns observed:
     - `{MSA_ABBREV}BPPRIVSA` (may exist for some MSAs)
   - Status: **Requires API discovery** - Limited availability

### County Level Patterns

1. **Unemployment Rate** ⚠️ (Variable Pattern)
   - Patterns observed:
     - `{STATE}{COUNTY_ABBREV}URN` (e.g., `ILCOOK1URN` for Cook County, IL)
     - `LAUCN{FIPS}0000000003A` (e.g., `LAUCN060370000000003A` for Los Angeles County)
   - Status: **Requires API discovery** - Pattern varies

2. **Employment Total** ⚠️ (Variable Pattern)
   - Patterns observed:
     - `LAUCN{FIPS}0000000005` (e.g., `LAUCN170310000000005` for Cook County)
   - Status: **Requires API discovery** - Pattern varies

3. **Median Household Income** ⚠️ (Variable Pattern)
   - Patterns observed:
     - `MEHOINUS{FIPS}A646N` (may exist for some counties)
   - Status: **Requires API discovery** - Limited availability

## Step-by-Step Population Process

### Step 1: Populate MSA GDP (Automatic)

MSA GDP follows a consistent pattern and can be auto-populated:

```bash
cd "C:\Projects\Real Estate\web"
npx tsx ../scripts/populate-msa-county-fred-ids.ts --geography=msa --pattern=gdp
```

This will:
- Find all MSAs without GDP series IDs
- Verify each `NGMP{CBSA_CODE}` series ID exists in FRED
- Update the database with valid series IDs

### Step 2: Discover MSA Series IDs (API Discovery)

For other MSA fields, use the discovery script:

```bash
# Discover for top 100 MSAs
npx tsx scripts/discover-msa-county-fred-ids.ts --geography=msa --limit=100
```

This will:
- Search FRED API for each MSA
- Find series IDs for unemployment_rate, employment_total, etc.
- Export results to CSV: `msa-fred-ids-discovery-{timestamp}.csv`

### Step 3: Review and Import Discovery Results

1. Open the CSV file
2. Review the discovered series IDs
3. Verify any questionable ones using: `npx tsx scripts/lookup-fred-series-ids.ts --search="SERIES_ID" --exact`
4. Import verified series IDs using the helper function:

```sql
-- Example: Update MSA unemployment rate
SELECT update_fred_series_id('31080', 'cbsa', 'unemployment_rate', 'LOSA106UR');

-- Or bulk update from CSV (after importing to temp table)
-- See scripts/migrations/008-populate-msa-county-fred-series-ids.sql for examples
```

### Step 4: Discover County Series IDs

For counties, use the discovery script:

```bash
# Discover for top 100 counties (by population)
npx tsx scripts/discover-msa-county-fred-ids.ts --geography=county --limit=100
```

This will:
- Search FRED API for each county
- Find series IDs for unemployment_rate, employment_total, median_household_income
- Export results to CSV: `county-fred-ids-discovery-{timestamp}.csv`

### Step 5: Review and Import County Results

Same process as Step 3, but for counties:

```sql
-- Example: Update county unemployment rate
SELECT update_fred_series_id('17031', 'county', 'unemployment_rate', 'ILCOOK1URN');
```

### Step 6: Sync to geographic_units

After populating series IDs, sync them to the `geographic_units` table:

```bash
npx tsx scripts/populate-msa-county-fred-ids.ts --sync
```

Or manually:

```sql
-- Sync MSAs
UPDATE geographic_units gu
SET 
  fred_unemployment_rate_series_id = cbsa.fred_unemployment_rate_series_id,
  fred_employment_total_series_id = cbsa.fred_employment_total_series_id,
  fred_gdp_series_id = cbsa.fred_gdp_series_id
FROM tiger_cbsa cbsa
WHERE gu.geoid = cbsa.geoid AND gu.level = 'cbsa';

-- Sync Counties
UPDATE geographic_units gu
SET 
  fred_unemployment_rate_series_id = county.fred_unemployment_rate_series_id,
  fred_employment_total_series_id = county.fred_employment_total_series_id
FROM tiger_counties county
WHERE gu.geoid = county.geoid AND gu.level = 'county';
```

## Helper Functions

### update_fred_series_id()

Manually update a single FRED series ID:

```sql
SELECT update_fred_series_id(
  '31080',                    -- geoid
  'cbsa',                     -- level: 'cbsa' or 'county'
  'unemployment_rate',        -- field
  'LOSA106UR'                 -- series_id
);
```

## Verification

After populating series IDs, verify them:

```bash
# Verify MSA series IDs
npx tsx scripts/verify-fred-series-ids.ts --geography=msa --field=unemployment_rate

# Verify County series IDs  
npx tsx scripts/verify-fred-series-ids.ts --geography=county --field=unemployment_rate
```

## Export for Review

Export current series IDs to CSV:

```bash
# Export MSA series IDs
npx tsx scripts/export-fred-series-ids.ts --geography=msa --output=msa-fred-ids-review.csv

# Export County series IDs (when implemented)
npx tsx scripts/export-fred-series-ids.ts --geography=county --output=county-fred-ids-review.csv
```

## Notes

1. **Rate Limiting**: FRED API has rate limits. Discovery scripts include delays between requests.

2. **Data Availability**: Not all MSAs/Counties have all fields available in FRED. Some fields (like median household income) are rarely available at MSA/County level.

3. **Pattern Variability**: MSA and County series IDs don't follow consistent patterns like states do. API discovery is the most reliable method.

4. **Prioritization**: Focus on high-population MSAs and counties first, as they're more likely to have complete data.

5. **Manual Review**: Always review discovery results before bulk importing, as the search may find incorrect series IDs.

## Next Steps

1. ✅ Run MSA GDP population (automatic)
2. ⏳ Run discovery for top 50 MSAs (unemployment, employment)
3. ⏳ Review and import MSA results
4. ⏳ Run discovery for top 100 counties
5. ⏳ Review and import county results
6. ⏳ Sync all to geographic_units
7. ⏳ Test FRED importer with MSA/County data

