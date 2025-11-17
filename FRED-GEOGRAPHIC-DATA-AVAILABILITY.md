# FRED Database Geographic Data Availability

This document organizes FRED (Federal Reserve Economic Data) database availability by geographic level.

## Overview

FRED provides economic time series data at various geographic levels. Data availability varies significantly by level, with national and state levels having the most comprehensive coverage, while city and ZIP code levels have minimal or no coverage.

---

## 1. National Level ✅ **COMPREHENSIVE**

### Available Data Types

**Economic Indicators:**
- **Unemployment Rate** - `UNRATE`
- **Employment** - Total Nonfarm Payrolls (`PAYEMS`)
- **GDP** - Gross Domestic Product (`GDP`)
- **Inflation** - Consumer Price Index (CPI), Producer Price Index (PPI)
- **Interest Rates** - Federal Funds Rate, Treasury rates
- **Mortgage Rates** - 30-Year Fixed (`MORTGAGE30US`), 15-Year Fixed (`MORTGAGE15US`)
- **Income** - Median Household Income (`MEHOINUSA646N`)
- **Housing** - Housing starts, building permits, home prices
- **Money Supply** - M1, M2, M3
- **Trade** - Exports, imports, trade balance
- **Productivity** - Labor productivity, multifactor productivity

**Frequency:** Daily, Weekly, Monthly, Quarterly, Annual (varies by series)  
**Time Range:** Decades of historical data (varies by series, often 1950s-present)  
**Status:** ✅ **Fully Available** - Most comprehensive level

---

## 2. State Level ✅ **VERY GOOD**

### Available Data Types

**Economic Indicators (Pattern-based series IDs):**

1. **Unemployment Rate** ✅
   - Pattern: `{STATE_ABBREV}UR`
   - Example: `CAUR` = California Unemployment Rate
   - Status: **Available for all 50 states + DC + territories**

2. **Employment Total (Nonfarm Payrolls)** ✅
   - Pattern: `{STATE_ABBREV}NA` or `{STATE_ABBREV}PAYEMS`
   - Example: `CANA` = California Total Nonfarm Payrolls
   - Status: **Available for all states**

3. **Median Household Income** ✅
   - Pattern: `MEHOINUS{STATE_ABBREV}A646N` or `MEHOINUS{STATE_FIPS}A646N`
   - Example: `MEHOINUSCAA646N` = California Median Household Income
   - Status: **Available for all states**

4. **GDP (Gross State Product)** ✅
   - Pattern: `{STATE_ABBREV}RGSP` or `NGMP{STATE_FIPS}000ALL`
   - Example: `CARGSP` = California Real Gross State Product
   - Status: **Available for all states**

5. **Housing Permits** ✅
   - Pattern: `{STATE_ABBREV}BPPRIVSA` or `{STATE_ABBREV}PERMIT`
   - Example: `CABPPRIVSA` = California Building Permits
   - Status: **Available for most states**

**Additional State-Level Data:**
- State personal income
- State tax revenue
- State employment by sector
- State housing prices (limited)

**Frequency:** Monthly, Quarterly, Annual  
**Time Range:** Varies by series (typically 1970s-present)  
**Status:** ✅ **Very Good** - Consistent patterns, comprehensive coverage

**Note:** Your codebase has already populated state-level FRED series IDs (see `state-fred-ids-complete.csv`)

---

## 3. MSA (Metropolitan Statistical Area) Level ⚠️ **MODERATE**

### Available Data Types

**Economic Indicators (Variable patterns, requires API discovery):**

1. **GDP** ✅
   - Pattern: `NGMP{CBSA_CODE}`
   - Example: `NGMP31080` = Los Angeles-Long Beach-Anaheim, CA MSA GDP
   - Status: **Available for most MSAs** - Consistent pattern

2. **Unemployment Rate** ⚠️
   - Patterns vary:
     - `{MSA_ABBREV}{CODE}UR` (e.g., `LOSA106UR` for Los Angeles)
     - `{MSA_ABBREV}{CODE}URN` (e.g., `AKRO439URN` for Akron)
     - `LAUMT{CBSA_CODE}0000000003` (alternative format)
   - Status: **Available for most MSAs** - Pattern varies, requires discovery

3. **Employment Total** ⚠️
   - Patterns vary:
     - `{MSA_ABBREV}{CODE}NA` (e.g., `ABIL148NA` for Abilene)
     - `SMS{CBSA_CODE}...` (e.g., `SMS36935610000000001` for New York)
   - Status: **Available for most MSAs** - Pattern varies significantly

4. **Median Household Income** ❌
   - Status: **Rarely available** - Most MSAs don't have this data in FRED

5. **Housing Permits** ⚠️
   - Pattern: `{MSA_ABBREV}BPPRIVSA` (may exist for some MSAs)
   - Status: **Limited availability** - Only for some larger MSAs

**Frequency:** Monthly, Quarterly, Annual  
**Time Range:** Varies by MSA and series (typically 1990s-present)  
**Status:** ⚠️ **Moderate** - Requires API discovery, patterns inconsistent

**Note:** Your codebase has discovery scripts for MSA-level data (see `scripts/discover-msa-county-fred-ids.ts`)

---

## 4. County Level ⚠️ **LIMITED**

### Available Data Types

**Economic Indicators (Variable patterns, requires API discovery):**

1. **Unemployment Rate** ⚠️
   - Patterns vary:
     - `{STATE}{COUNTY_ABBREV}URN` (e.g., `ILCOOK1URN` for Cook County, IL)
     - `LAUCN{FIPS}0000000003A` (e.g., `LAUCN060370000000003A` for Los Angeles County)
   - Status: **Available for most counties** - Pattern varies

2. **Employment Total** ⚠️
   - Patterns vary:
     - `LAUCN{FIPS}0000000005` (e.g., `LAUCN170310000000005` for Cook County)
   - Status: **Available for most counties** - Pattern varies

3. **Median Household Income** ⚠️
   - Pattern: `MEHOINUS{FIPS}A646N` (may exist for some counties)
   - Status: **Limited availability** - Only for some larger counties

4. **GDP** ❌
   - Status: **Not available** - County-level GDP not typically available in FRED

5. **Housing Permits** ❌
   - Status: **Not available** - County-level housing permits not typically available

**Frequency:** Monthly, Quarterly, Annual  
**Time Range:** Varies by county and series (typically 1990s-present)  
**Status:** ⚠️ **Limited** - Requires API discovery, inconsistent patterns, fewer series available

**Note:** Your codebase has discovery scripts for county-level data (see `scripts/discover-msa-county-fred-ids.ts`)

---

## 5. City Level ❌ **MINIMAL TO NONE**

### Available Data Types

**Economic Indicators:**

- **Unemployment Rate** ❌ - Not typically available at city level
- **Employment** ❌ - Not typically available at city level
- **Income** ❌ - Not typically available at city level
- **GDP** ❌ - Not available at city level
- **Housing** ❌ - Not typically available at city level

**Status:** ❌ **Minimal to None** - FRED does not provide city-level economic data

**Alternative Sources:**
- Use MSA-level data as proxy for city-level analysis
- Use county-level data if city is within a single county
- Consider Census Bureau data for city-level demographics

---

## 6. ZIP Code / ZCTA Level ❌ **NOT AVAILABLE**

### Available Data Types

**Economic Indicators:**

- **Unemployment Rate** ❌ - Not available at ZIP code level
- **Employment** ❌ - Not available at ZIP code level
- **Income** ❌ - Not available at ZIP code level
- **GDP** ❌ - Not available at ZIP code level
- **Housing** ❌ - Not available at ZIP code level

**Status:** ❌ **Not Available** - FRED does not provide ZIP code or ZCTA-level economic data

**Alternative Sources:**
- **Census Bureau** - Provides demographic data at ZCTA level (5-year ACS estimates)
- **Zillow** - Provides housing data at ZIP code level
- **Redfin** - Provides housing data at ZIP code level

---

## Summary Table

| Geographic Level | Unemployment | Employment | Income | GDP | Housing | Overall Status |
|-----------------|--------------|------------|--------|-----|---------|----------------|
| **National** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ **Comprehensive** |
| **State** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ **Very Good** |
| **MSA** | ⚠️ | ⚠️ | ❌ | ✅ | ⚠️ | ⚠️ **Moderate** |
| **County** | ⚠️ | ⚠️ | ⚠️ | ❌ | ❌ | ⚠️ **Limited** |
| **City** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ **Minimal/None** |
| **ZIP/ZCTA** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ **Not Available** |

**Legend:**
- ✅ = Available with consistent patterns
- ⚠️ = Available but requires discovery/verification
- ❌ = Not available or very limited

---

## FRED Series ID Patterns Reference

### State Level (Consistent Patterns)
```
Unemployment Rate:     {STATE_ABBREV}UR
Employment Total:      {STATE_ABBREV}NA or {STATE_ABBREV}PAYEMS
Median Income:         MEHOINUS{STATE_ABBREV}A646N or MEHOINUS{STATE_FIPS}A646N
GDP:                   {STATE_ABBREV}RGSP or NGMP{STATE_FIPS}000ALL
Housing Permits:       {STATE_ABBREV}BPPRIVSA or {STATE_ABBREV}PERMIT
```

### MSA Level (Variable Patterns)
```
GDP:                   NGMP{CBSA_CODE} ✅ (consistent)
Unemployment Rate:     {MSA_ABBREV}{CODE}UR or {MSA_ABBREV}{CODE}URN ⚠️ (varies)
Employment Total:      {MSA_ABBREV}{CODE}NA or SMS{CBSA_CODE}... ⚠️ (varies)
```

### County Level (Variable Patterns)
```
Unemployment Rate:     {STATE}{COUNTY_ABBREV}URN or LAUCN{FIPS}0000000003A ⚠️ (varies)
Employment Total:      LAUCN{FIPS}0000000005 ⚠️ (varies)
```

---

## Recommendations for Your Project

1. **National Level**: Use FRED for comprehensive economic indicators
2. **State Level**: Use FRED for all available indicators (already implemented in your codebase)
3. **MSA Level**: Use FRED for GDP and employment/unemployment (requires discovery scripts)
4. **County Level**: Use FRED for employment/unemployment only (limited availability)
5. **City/ZIP Level**: Do NOT use FRED - use Census Bureau, Zillow, or Redfin instead

---

## Related Files in Your Codebase

- `web/lib/data-ingestion/sources/fred.ts` - FRED import implementation
- `scripts/importers/fred-api-importer.ts` - Advanced FRED importer
- `scripts/migrations/FRED-SERIES-ID-POPULATION-PLAN.md` - State-level implementation plan
- `scripts/migrations/MSA-COUNTY-FRED-IDS-GUIDE.md` - MSA/County discovery guide
- `state-fred-ids-complete.csv` - Populated state-level series IDs
- `scripts/discover-msa-county-fred-ids.ts` - MSA/County discovery script
- `scripts/verify-fred-series-ids.ts` - Series ID verification script

---

## Additional Resources

- **FRED API Documentation**: https://fred.stlouisfed.org/docs/api/
- **FRED Regional Data Maps API**: https://fred.stlouisfed.org/docs/api/geofred/regional_data.html
- **FRED Series Search**: https://fred.stlouisfed.org/
- **Census Bureau ZCTA Data**: https://www.census.gov/programs-surveys/geography/guidance/geo-areas/zctas.html

