# CSV Geography Mapping Analysis

## Overview

Analysis of three CSV files for geographic mapping integration with the Real Estate database:
1. **Metro Areas.csv** - CBSA (Core Based Statistical Area) data
2. **States.csv** - State information with FIPS codes
3. **County to State.csv** - County-to-state relationships with FIPS codes

## File Structure Analysis

### 1. Metro Areas.csv

**Structure:**
- **Name (CSBA)**: Full CBSA name (e.g., "New York-Newark-Jersey City, NY-NJ")
- **CBSA Code**: 5-digit CBSA code (e.g., "35620")
- **Metropolitan/Micropolitan Statistical Area**: Type indicator ("Metropolitan Statistical Area" or "Micropolitan Statistical Area")
- **Population**: Integer population count

**Key Observations:**
- Contains 936 rows (including header)
- Includes both Metropolitan and Micropolitan areas
- Some Puerto Rico entries have empty population values
- CBSA codes are 5-digit numeric strings
- Names include state abbreviations in parentheses

**Database Mapping:**
- Maps to `tiger_cbsa` table
- `geoid` = CBSA Code (5-digit)
- `name` = Name (CSBA)
- `lsad` = "M1" for Metropolitan, "M2" for Micropolitan (needs conversion)
- Missing: `population` field (needs to be added to table or stored elsewhere)

### 2. States.csv

**Structure:**
- **State Abbreviation**: 2-letter code (e.g., "AL", "CA")
- **State Name**: Full state name (e.g., "Alabama", "California")
- **Population**: Integer population count
- **State Name Fragment**: URL-friendly slug (e.g., "alabama", "california")
- **FIPS code**: 2-digit FIPS code (e.g., "01", "02")

**Key Observations:**
- Contains 60 rows (including header)
- Includes all 50 states + DC + territories (Puerto Rico, Virgin Islands, Guam, etc.)
- Some territories have empty population values
- FIPS codes are 2-digit strings (zero-padded)
- Includes both US states and territories

**Database Mapping:**
- Maps to `tiger_states` table
- `geoid` = FIPS code (2-digit)
- `name` = State Name
- Missing: `population`, `state_abbreviation`, `name_fragment` fields (may need to be added)

### 3. County to State.csv

**Structure:**
- **County**: Full county name (e.g., "Autauga County")
- **State**: Full state name (e.g., "Alabama")
- **State Abbreviation**: 2-letter code (e.g., "AL")
- **County Population**: Integer population count
- **FIPS - County Code**: 5-digit FIPS code (state + county, e.g., "01001")
- **County Name Fragment**: URL-friendly slug (e.g., "autauga-county-al")
- **County % of State Population**: Decimal percentage
- **State Population**: Integer population count (duplicated from States.csv)

**Key Observations:**
- Contains 3,244 rows (including header)
- One row per county
- FIPS codes are 5-digit (2-digit state + 3-digit county)
- Includes population data and percentage calculations
- State population is duplicated (could be normalized)

**Database Mapping:**
- Maps to `tiger_counties` table
- `geoid` = FIPS - County Code (5-digit)
- `name` = County name
- `state_fips` = First 2 digits of FIPS code
- Missing: `population`, `county_name_fragment`, `pct_of_state_population` fields

## Database Schema Comparison

### Current Database Tables

#### `tiger_cbsa`
```sql
- geoid VARCHAR(5) PRIMARY KEY
- name VARCHAR(255)
- lsad VARCHAR(50)  -- "M1" = Metro, "M2" = Micro
- geometry GEOMETRY(MultiPolygon, 4326)
- created_at TIMESTAMPTZ
```

**Missing Fields:**
- `population` BIGINT

#### `tiger_states`
```sql
- geoid VARCHAR(2) PRIMARY KEY
- name VARCHAR(100)
- geometry GEOMETRY(MultiPolygon, 4326)
- created_at TIMESTAMPTZ
```

**Missing Fields:**
- `state_abbreviation` VARCHAR(2)
- `population` BIGINT
- `name_fragment` VARCHAR(100)

#### `tiger_counties`
```sql
- geoid VARCHAR(5) PRIMARY KEY
- name VARCHAR(100)
- state_fips VARCHAR(2)
- geometry GEOMETRY(MultiPolygon, 4326)
- created_at TIMESTAMPTZ
```

**Missing Fields:**
- `population` BIGINT
- `county_name_fragment` VARCHAR(255)
- `pct_of_state_population` DECIMAL(10,8)

## Data Quality Issues

### Metro Areas.csv
1. **Empty Populations**: Puerto Rico entries (rows 927-936) have empty population values
2. **Name Formatting**: Names include state abbreviations in parentheses (e.g., "New York-Newark-Jersey City, NY-NJ")
3. **LSAD Conversion**: Need to convert "Metropolitan Statistical Area" → "M1" and "Micropolitan Statistical Area" → "M2"

### States.csv
1. **Empty Populations**: Some territories (VI, GU, AS, FM, MH, MP, PW) have empty population values
2. **FIPS Code Format**: FIPS codes are strings, need to ensure zero-padding (e.g., "01" not "1")
3. **Territories**: Includes non-state territories that may need special handling

### County to State.csv
1. **Data Redundancy**: State population is duplicated in every county row
2. **FIPS Code Format**: Need to ensure 5-digit format with leading zeros
3. **Name Formatting**: County names include "County" suffix (e.g., "Autauga County")

## Mapping Strategy

### 1. CBSA (Metro Areas) Mapping

**CSV → Database:**
```
Name (CSBA) → tiger_cbsa.name
CBSA Code → tiger_cbsa.geoid
Metropolitan/Micropolitan Statistical Area → tiger_cbsa.lsad (convert to M1/M2)
Population → tiger_cbsa.population (needs column addition)
```

**Conversion Logic:**
```sql
-- Convert LSAD type
CASE 
  WHEN "Metropolitan/Micropolitan Statistical Area" = 'Metropolitan Statistical Area' THEN 'M1'
  WHEN "Metropolitan/Micropolitan Statistical Area" = 'Micropolitan Statistical Area' THEN 'M2'
  ELSE NULL
END
```

### 2. States Mapping

**CSV → Database:**
```
FIPS code → tiger_states.geoid
State Name → tiger_states.name
State Abbreviation → tiger_states.state_abbreviation (needs column addition)
Population → tiger_states.population (needs column addition)
State Name Fragment → tiger_states.name_fragment (needs column addition)
```

### 3. Counties Mapping

**CSV → Database:**
```
FIPS - County Code → tiger_counties.geoid
County → tiger_counties.name (remove "County" suffix?)
State → tiger_counties.state_fips (extract from FIPS code)
County Population → tiger_counties.population (needs column addition)
County Name Fragment → tiger_counties.county_name_fragment (needs column addition)
County % of State Population → tiger_counties.pct_of_state_population (needs column addition)
```

## Recommended Actions

### 1. Schema Enhancements

**Add to `tiger_cbsa`:**
```sql
ALTER TABLE tiger_cbsa ADD COLUMN IF NOT EXISTS population BIGINT;
CREATE INDEX IF NOT EXISTS idx_tiger_cbsa_population ON tiger_cbsa(population);
```

**Add to `tiger_states`:**
```sql
ALTER TABLE tiger_states ADD COLUMN IF NOT EXISTS state_abbreviation VARCHAR(2);
ALTER TABLE tiger_states ADD COLUMN IF NOT EXISTS population BIGINT;
ALTER TABLE tiger_states ADD COLUMN IF NOT EXISTS name_fragment VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_tiger_states_abbreviation ON tiger_states(state_abbreviation);
CREATE INDEX IF NOT EXISTS idx_tiger_states_population ON tiger_states(population);
```

**Add to `tiger_counties`:**
```sql
ALTER TABLE tiger_counties ADD COLUMN IF NOT EXISTS population BIGINT;
ALTER TABLE tiger_counties ADD COLUMN IF NOT EXISTS county_name_fragment VARCHAR(255);
ALTER TABLE tiger_counties ADD COLUMN IF NOT EXISTS pct_of_state_population DECIMAL(10,8);
CREATE INDEX IF NOT EXISTS idx_tiger_counties_population ON tiger_counties(population);
CREATE INDEX IF NOT EXISTS idx_tiger_counties_state_pop ON tiger_counties(state_fips, population);
```

### 2. Data Import Script

Create a TypeScript/Node.js script to:
1. Read CSV files
2. Validate data (check FIPS codes, handle empty values)
3. Transform data (convert LSAD types, extract state FIPS from county FIPS)
4. Upsert into database tables
5. Handle duplicates and conflicts

### 3. Data Validation

**Pre-import Checks:**
- Verify all CBSA codes are 5-digit numeric
- Verify all state FIPS codes are 2-digit
- Verify all county FIPS codes are 5-digit
- Check for duplicate GEOIDs
- Validate population values (non-negative integers)
- Handle NULL/empty population values appropriately

**Post-import Checks:**
- Verify row counts match expected values
- Check referential integrity (counties → states)
- Validate population totals (county populations should sum to state populations approximately)

## Relationship Mapping

### Hierarchical Relationships

```
National
  └── States (tiger_states)
       └── Counties (tiger_counties)
            └── Places (tiger_places)
                 └── ZIP Codes (tiger_zcta)

CBSA (tiger_cbsa) - Can span multiple states/counties
  └── Counties (many-to-many via geo_county_cbsa)
  └── ZIP Codes (many-to-many via geo_zip_cbsa)
```

### Junction Tables Needed

The CSV files provide direct relationships:
- **County → State**: Already in `tiger_counties.state_fips` (one-to-many)
- **CBSA → Counties**: Needs `geo_county_cbsa` junction table (many-to-many)
- **CBSA → States**: Can be derived from CBSA → Counties → States

## Next Steps

1. **Review and approve schema changes** (add population and metadata fields)
2. **Create data import script** with validation and error handling
3. **Test import with sample data** before full import
4. **Build CBSA-County relationships** using spatial queries or additional data sources
5. **Update geo_hierarchy table** with new population data
6. **Create indexes** for performance on population queries

## File Statistics

### Metro Areas.csv
- **Total Rows**: 936 (935 data rows + 1 header)
- **Metropolitan Areas**: ~390
- **Micropolitan Areas**: ~545
- **Empty Populations**: 10 (Puerto Rico entries)

### States.csv
- **Total Rows**: 60 (59 data rows + 1 header)
- **US States + DC**: 51
- **Territories**: 8
- **Empty Populations**: 7 (territories)

### County to State.csv
- **Total Rows**: 3,244 (3,243 data rows + 1 header)
- **Unique States**: 50 + DC + territories
- **Counties per State**: Varies (e.g., Delaware has 3, Texas has 254)

