# FRED Series ID Population Plan

## Overview

This document outlines the plan to populate FRED series IDs for economic indicators (employment, income, GDP, housing) in the normalization tables for states, counties, and MSAs.

## FRED Series ID Patterns

### State-Level Series IDs

FRED uses consistent patterns for state-level data:

1. **Unemployment Rate** ✅ (Already populated)
   - Pattern: `{STATE_ABBREV}UR`
   - Example: `CAUR` = California Unemployment Rate
   - Status: **COMPLETE** - All 54 states populated

2. **Employment Total (Nonfarm Payrolls)**
   - Pattern: `{STATE_ABBREV}PAYEMS`
   - Example: `CAPAYEMS` = California Total Nonfarm Payrolls
   - Status: **TODO** - Needs population

3. **Median Household Income**
   - Pattern: `MEHOINUS{STATE_FIPS}A646N`
   - Example: `MEHOINUS06A646N` = California Median Household Income (FIPS 06)
   - Alternative: May also use `{STATE_ABBREV}MEHOIN` format
   - Status: **TODO** - Needs population and verification

4. **GDP (Gross Domestic Product)**
   - Pattern: `NGMP{STATE_FIPS}ALL` or `GDP{STATE_ABBREV}`
   - Example: `NGMP06000ALL` = California GDP (FIPS 06)
   - Status: **TODO** - Needs population and verification

5. **Housing Permits**
   - Pattern: `{STATE_ABBREV}PERMIT` or `PERMIT{STATE_FIPS}`
   - Example: `CAPERMIT` = California Building Permits
   - Status: **TODO** - Needs population and verification

### County-Level Series IDs

County-level data is less standardized and may require manual lookup:

1. **Unemployment Rate**
   - Pattern: `{STATE_FIPS}{COUNTY_FIPS}UR` or `LAUCN{STATE_FIPS}{COUNTY_FIPS}0000000003`
   - Example: `06037UR` = Los Angeles County, CA (FIPS 06037)
   - Status: **TODO** - Needs population

2. **Employment Total**
   - Pattern: `{STATE_FIPS}{COUNTY_FIPS}PAYEMS` or `ENUC{STATE_FIPS}{COUNTY_FIPS}10`
   - Status: **TODO** - Needs population

3. **Median Household Income**
   - Pattern: `MEHOINUS{STATE_FIPS}{COUNTY_FIPS}A646N`
   - Example: `MEHOINUS06037A646N` = Los Angeles County, CA
   - Status: **TODO** - Needs population

### MSA-Level Series IDs

MSA (Metropolitan Statistical Area) series IDs use CBSA codes:

1. **Unemployment Rate**
   - Pattern: `{CBSA_CODE}UR` or `LAUMT{CBSA_CODE}0000000003`
   - Example: `31080UR` = Los Angeles-Long Beach-Anaheim, CA MSA
   - Status: **TODO** - Needs population

2. **Employment Total**
   - Pattern: `{CBSA_CODE}PAYEMS` or `ENUC{CBSA_CODE}10`
   - Status: **TODO** - Needs population

3. **GDP**
   - Pattern: `NGMP{CBSA_CODE}000` = MSA GDP
   - Status: **TODO** - Needs population

## Population Strategy

### Phase 1: State-Level Data (High Priority)

1. **Employment Total (PAYEMS)**
   - Use pattern: `{STATE_ABBREV}PAYEMS`
   - Can be auto-populated from `state_abbreviation`
   - Verification: Test a few states via FRED API

2. **Median Household Income**
   - Use pattern: `MEHOINUS{STATE_FIPS}A646N`
   - Can be auto-populated from `geoid` (state FIPS)
   - Verification: Test a few states via FRED API

3. **GDP**
   - Use pattern: `NGMP{STATE_FIPS}000ALL` or lookup required
   - May need manual verification per state

4. **Housing Permits**
   - Use pattern: `{STATE_ABBREV}PERMIT`
   - Can be auto-populated from `state_abbreviation`
   - Verification: Test a few states via FRED API

### Phase 2: MSA-Level Data (Medium Priority)

1. Use CBSA codes from `tiger_cbsa.geoid`
2. Apply patterns above
3. Manual verification recommended for top 50 MSAs

### Phase 3: County-Level Data (Lower Priority)

1. Use FIPS codes from `tiger_counties.geoid`
2. Apply patterns above
3. May require API lookup for verification
4. Focus on high-population counties first

## Implementation Steps

### Step 1: Create Population Scripts

1. **Auto-populate state-level series IDs** using known patterns
2. **Create verification script** to test series IDs via FRED API
3. **Create lookup helper** for manual verification

### Step 2: Verification Process

1. Test sample series IDs via FRED API
2. Document any exceptions or variations
3. Update patterns as needed

### Step 3: Bulk Population

1. Run auto-population scripts
2. Verify results
3. Manually fix any exceptions

### Step 4: Documentation

1. Document verified patterns
2. Create reference table of series IDs
3. Update this plan with findings

## Tools and Scripts

1. **`populate-state-fred-series-ids.sql`** - Auto-populate state series IDs
2. **`verify-fred-series-ids.ts`** - Test series IDs via FRED API
3. **`lookup-fred-series-ids.ts`** - Helper to search FRED API for series IDs
4. **`export-fred-series-ids.ts`** - Export current series IDs for review

## Next Steps

1. ✅ Create population scripts
2. ⏳ Test patterns with sample states
3. ⏳ Populate state-level series IDs
4. ⏳ Verify and document results
5. ⏳ Repeat for MSA and County levels

