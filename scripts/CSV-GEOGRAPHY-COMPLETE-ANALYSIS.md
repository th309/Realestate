# Complete CSV Geography Mapping Analysis

## Overview

Comprehensive analysis of **8 CSV files** in the `data/Normalization/` folder for geographic mapping integration with the Real Estate database. These files provide a complete geographic hierarchy from ZIP codes to metros, including demographic data.

## File Inventory

| # | File Name | Rows (approx) | Purpose | Key Relationships |
|---|-----------|---------------|---------|-------------------|
| 1 | **Metro Areas.csv** | 936 | CBSA definitions | CBSA Code → Name, Type, Population |
| 2 | **States.csv** | 60 | State definitions | FIPS → Name, Abbreviation, Population |
| 3 | **County to State.csv** | 3,244 | County definitions | County FIPS → State FIPS, Population |
| 4 | **County to ZIP.csv** | 54,554 | County-ZIP relationships | County FIPS → ZIP, Percentage |
| 5 | **Metro to ZIP Code.csv** | 35,988 | Metro-ZIP relationships | CBSA Code → ZIP, Percentage |
| 6 | **ZIP Code Demographics.csv** | 33,764 | ZIP demographic data | ZIP → Demographics (200+ fields) |
| 7 | **Zip to County.csv** | 54,554 | ZIP-County relationships | ZIP → County FIPS, Percentage |
| 8 | **ZIP to State, Town, Metro.csv** | 39,494 | ZIP comprehensive mapping | ZIP → State, Town, Metro, CBSA Code |

## Detailed File Analysis

### 1. Metro Areas.csv

**Structure:**
- **Name (CSBA)**: Full CBSA name (e.g., "New York-Newark-Jersey City, NY-NJ")
- **CBSA Code**: 5-digit CBSA code (e.g., "35620")
- **Metropolitan/Micropolitan Statistical Area**: Type indicator
- **Population**: Integer population count

**Database Mapping:**
- Maps to `tiger_cbsa` table
- `geoid` = CBSA Code (5-digit)
- `name` = Name (CSBA)
- `lsad` = Convert: "Metropolitan Statistical Area" → "M1", "Micropolitan Statistical Area" → "M2"
- `population` = Population (needs column addition)

**Data Quality:**
- 10 Puerto Rico entries have empty population values
- Includes both Metropolitan and Micropolitan areas

---

### 2. States.csv

**Structure:**
- **State Abbreviation**: 2-letter code (e.g., "AL", "CA")
- **State Name**: Full state name (e.g., "Alabama", "California")
- **Population**: Integer population count
- **State Name Fragment**: URL-friendly slug (e.g., "alabama")
- **FIPS code**: 2-digit FIPS code (e.g., "01", "02")

**Database Mapping:**
- Maps to `tiger_states` table
- `geoid` = FIPS code (2-digit)
- `name` = State Name
- `state_abbreviation` = State Abbreviation (needs column)
- `population` = Population (needs column)
- `name_fragment` = State Name Fragment (needs column)

**Data Quality:**
- Includes all 50 states + DC + territories
- 7 territories have empty population values

---

### 3. County to State.csv

**Structure:**
- **County**: Full county name (e.g., "Autauga County")
- **State**: Full state name (e.g., "Alabama")
- **State Abbreviation**: 2-letter code (e.g., "AL")
- **County Population**: Integer population count
- **FIPS - County Code**: 5-digit FIPS code (e.g., "01001")
- **County Name Fragment**: URL-friendly slug (e.g., "autauga-county-al")
- **County % of State Population**: Decimal percentage
- **State Population**: Integer (duplicated from States.csv)

**Database Mapping:**
- Maps to `tiger_counties` table
- `geoid` = FIPS - County Code (5-digit)
- `name` = County name (remove "County" suffix?)
- `state_fips` = First 2 digits of FIPS code
- `population` = County Population (needs column)
- `county_name_fragment` = County Name Fragment (needs column)
- `pct_of_state_population` = County % of State Population (needs column)

**Data Quality:**
- One row per county (3,243 counties)
- State population duplicated in every row

---

### 4. County to ZIP.csv

**Structure:**
- **County**: Full county name
- **State**: Full state name
- **County Code**: 5-digit FIPS code
- **ZIP**: 5-digit ZIP code
- **USPS Default City for ZIP**: City name
- **USPS Default State for ZIP**: State abbreviation
- **% of County Residents in ZIP**: Decimal percentage
- **County Population**: Integer (duplicated)

**Database Mapping:**
- Maps to `geo_zip_county` junction table
- `county_geoid` = County Code (5-digit FIPS)
- `zip_geoid` = ZIP (5-digit)
- `overlap_percentage` = % of County Residents in ZIP
- `is_primary` = true if overlap_percentage > 50%

**Key Relationships:**
- One county can have many ZIPs
- One ZIP can span multiple counties (shown in Zip to County.csv)
- Percentage indicates what portion of county residents live in each ZIP

---

### 5. Metro to ZIP Code.csv

**Structure:**
- **Name (CSBA)**: Full CBSA name
- **CBSA Code**: 5-digit CBSA code
- **Metropolitan/Micropolitan Statistical Area**: Type indicator
- **ZIP**: 5-digit ZIP code
- **USPS Default City for ZIP**: City name
- **USPS Default State for ZIP**: State abbreviation
- **% of Metro Residents in ZIP**: Decimal percentage
- **Total Metro Residents**: Integer (duplicated)

**Database Mapping:**
- Maps to `geo_zip_cbsa` junction table
- `cbsa_geoid` = CBSA Code (5-digit)
- `zip_geoid` = ZIP (5-digit)
- `overlap_percentage` = % of Metro Residents in ZIP
- `is_primary` = true if overlap_percentage > 50%

**Key Relationships:**
- One CBSA can have many ZIPs
- One ZIP can belong to multiple CBSAs (rare but possible)
- Percentage indicates what portion of metro residents live in each ZIP

---

### 6. ZIP Code Demographics.csv ⭐ (Largest Dataset)

**Structure:**
- **ZIP Code**: 5-digit ZIP code
- **Town**: City/town name
- **State Abbreviation**: 2-letter code
- **State**: Full state name
- **Metro**: CBSA name
- **Primary County**: County name
- **Total population**: Integer
- **Median Household Income**: Numeric
- **200+ demographic fields**: Age groups, race, ethnicity, housing, etc.

**Key Demographic Fields:**
- Age distribution (Under 5, 5-9, 10-14, ..., 85+)
- Gender (Male, Female, Sex ratio)
- Race (White, Black, Asian, Native American, etc.)
- Ethnicity (Hispanic/Latino breakdowns)
- Housing (Total housing units)
- Income (Median household income)
- Education (various degree levels)
- Citizenship status

**Database Mapping:**
- Maps to `census_demographics` table (or new `zip_demographics` table)
- `geoid` = ZIP Code (5-digit)
- Many fields map to existing `census_demographics` columns
- May need new table or extend existing table

**Data Quality:**
- Most comprehensive dataset (200+ columns)
- Some ZIPs may have missing data
- Population totals should match other files

---

### 7. Zip to County.csv

**Structure:**
- **ZIP**: 5-digit ZIP code
- **USPS Default State for ZIP**: State abbreviation
- **County**: Full county name
- **County State**: Full state name
- **State Abbreviation**: 2-letter code
- **COUNTY Code**: 5-digit FIPS code
- **ZIP Code Population**: Integer
- **% of ZIP Residents in County**: Decimal percentage
- **# of Counties**: Integer (how many counties this ZIP spans)
- **USPS Default City for ZIP**: City name

**Database Mapping:**
- Maps to `geo_zip_county` junction table (same as County to ZIP.csv, but reversed perspective)
- `zip_geoid` = ZIP (5-digit)
- `county_geoid` = COUNTY Code (5-digit FIPS)
- `overlap_percentage` = % of ZIP Residents in County
- `is_primary` = true if overlap_percentage > 50%

**Key Relationships:**
- Shows which counties a ZIP spans
- Percentage indicates what portion of ZIP residents live in each county
- Some ZIPs span multiple counties (shown by # of Counties > 1)

**Note:** This is the reverse perspective of County to ZIP.csv. Both files contain the same relationships but from different angles.

---

### 8. ZIP to State, Town, Metro.csv

**Structure:**
- **ZIP Code**: 5-digit ZIP code
- **USPS Default State for ZIP**: State abbreviation
- **State**: Full state name
- **USPS Default City for ZIP**: City/town name
- **Metro (CBSA)**: CBSA name
- **ZIP Code Population**: Integer
- **CBSA Code**: 5-digit CBSA code

**Database Mapping:**
- Maps to multiple tables:
  - `tiger_zcta` - ZIP code table (needs population column)
  - `geo_zip_cbsa` - ZIP to CBSA relationship
  - `geo_zip_place` - ZIP to Place/Town relationship (if places table exists)

**Key Relationships:**
- One ZIP → One State (primary)
- One ZIP → One Town/City (primary)
- One ZIP → One Metro/CBSA (primary)
- Provides quick lookup for ZIP's primary geographic associations

**Data Quality:**
- Some ZIPs have empty population values
- Provides primary relationships (not all relationships like junction tables)

---

## Database Schema Mapping

### Core Geographic Tables

#### `tiger_cbsa` (Metro Areas)
```sql
-- Current columns:
geoid VARCHAR(5) PRIMARY KEY
name VARCHAR(255)
lsad VARCHAR(50)  -- "M1" = Metro, "M2" = Micro
geometry GEOMETRY(MultiPolygon, 4326)
created_at TIMESTAMPTZ

-- Needs:
population BIGINT
```

#### `tiger_states` (States)
```sql
-- Current columns:
geoid VARCHAR(2) PRIMARY KEY
name VARCHAR(100)
geometry GEOMETRY(MultiPolygon, 4326)
created_at TIMESTAMPTZ

-- Needs:
state_abbreviation VARCHAR(2)
population BIGINT
name_fragment VARCHAR(100)
```

#### `tiger_counties` (Counties)
```sql
-- Current columns:
geoid VARCHAR(5) PRIMARY KEY
name VARCHAR(100)
state_fips VARCHAR(2)
geometry GEOMETRY(MultiPolygon, 4326)
created_at TIMESTAMPTZ

-- Needs:
population BIGINT
county_name_fragment VARCHAR(255)
pct_of_state_population DECIMAL(10,8)
```

#### `tiger_zcta` (ZIP Codes)
```sql
-- Current columns:
geoid VARCHAR(5) PRIMARY KEY
geometry GEOMETRY(MultiPolygon, 4326)
created_at TIMESTAMPTZ

-- Needs:
population BIGINT
default_city VARCHAR(255)
default_state VARCHAR(2)
```

### Junction Tables (Many-to-Many Relationships)

#### `geo_zip_county` (ZIP ↔ County)
```sql
-- Current columns:
zip_geoid VARCHAR(5)
county_geoid VARCHAR(5)
overlap_percentage NUMERIC
overlap_area_sqkm NUMERIC
is_primary BOOLEAN
created_at TIMESTAMPTZ

-- Data sources:
- County to ZIP.csv (county perspective)
- Zip to County.csv (ZIP perspective)
```

#### `geo_zip_cbsa` (ZIP ↔ CBSA)
```sql
-- Current columns:
zip_geoid VARCHAR(5)
cbsa_geoid VARCHAR(5)
overlap_percentage NUMERIC
overlap_area_sqkm NUMERIC
is_primary BOOLEAN
created_at TIMESTAMPTZ

-- Data sources:
- Metro to ZIP Code.csv
- ZIP to State, Town, Metro.csv (for primary relationships)
```

#### `geo_county_state` (County ↔ State)
```sql
-- Current columns:
county_geoid VARCHAR(5)
state_geoid VARCHAR(2)
created_at TIMESTAMPTZ

-- Data sources:
- County to State.csv (one-to-many, but stored for consistency)
```

### Demographic Data Tables

#### `census_demographics` (ZIP Demographics)
```sql
-- Current columns (partial list):
geoid TEXT
vintage_year INTEGER
total_population INTEGER
median_age NUMERIC
total_households INTEGER
avg_household_size NUMERIC
population_under_18_pct NUMERIC
population_18_34_pct NUMERIC
population_35_54_pct NUMERIC
population_65_plus_pct NUMERIC
bachelors_degree_pct NUMERIC
graduate_degree_pct NUMERIC
...

-- Data source:
- ZIP Code Demographics.csv (200+ fields)
```

## Data Flow and Relationships

### Hierarchical Structure

```
National
  └── States (tiger_states)
       └── Counties (tiger_counties)
            └── ZIP Codes (tiger_zcta)
                 └── Demographics (census_demographics)

CBSA (tiger_cbsa) - Can span multiple states/counties
  └── Counties (many-to-many via geo_county_cbsa)
  └── ZIP Codes (many-to-many via geo_zip_cbsa)
```

### Relationship Matrix

| From | To | Junction Table | CSV Source(s) | Type |
|------|-----|----------------|---------------|------|
| ZIP | County | `geo_zip_county` | County to ZIP.csv, Zip to County.csv | Many-to-Many |
| ZIP | CBSA | `geo_zip_cbsa` | Metro to ZIP Code.csv, ZIP to State, Town, Metro.csv | Many-to-Many |
| County | State | `geo_county_state` | County to State.csv | One-to-Many |
| ZIP | Demographics | `census_demographics` | ZIP Code Demographics.csv | One-to-One |

## Import Strategy

### Phase 1: Core Geographic Entities
1. **States** (`tiger_states`)
   - Import from States.csv
   - Add population, abbreviation, name_fragment

2. **Counties** (`tiger_counties`)
   - Import from County to State.csv
   - Add population, name_fragment, pct_of_state_population

3. **CBSA** (`tiger_cbsa`)
   - Import from Metro Areas.csv
   - Convert LSAD types (Metropolitan → "M1", Micropolitan → "M2")
   - Add population

4. **ZIP Codes** (`tiger_zcta`)
   - Import from ZIP to State, Town, Metro.csv
   - Add population, default_city, default_state

### Phase 2: Relationships (Junction Tables)
1. **County to State** (`geo_county_state`)
   - Import from County to State.csv
   - One-to-many relationship

2. **ZIP to County** (`geo_zip_county`)
   - Import from Zip to County.csv (ZIP perspective)
   - Or County to ZIP.csv (County perspective)
   - Set `is_primary` flag based on overlap_percentage > 50%

3. **ZIP to CBSA** (`geo_zip_cbsa`)
   - Import from Metro to ZIP Code.csv
   - Set `is_primary` flag based on overlap_percentage > 50%

### Phase 3: Demographic Data
1. **ZIP Demographics** (`census_demographics`)
   - Import from ZIP Code Demographics.csv
   - Map 200+ fields to existing table structure
   - May need to extend table schema

## Required Schema Changes

### ALTER TABLE tiger_cbsa
```sql
ALTER TABLE tiger_cbsa ADD COLUMN IF NOT EXISTS population BIGINT;
CREATE INDEX IF NOT EXISTS idx_tiger_cbsa_population ON tiger_cbsa(population);
```

### ALTER TABLE tiger_states
```sql
ALTER TABLE tiger_states ADD COLUMN IF NOT EXISTS state_abbreviation VARCHAR(2);
ALTER TABLE tiger_states ADD COLUMN IF NOT EXISTS population BIGINT;
ALTER TABLE tiger_states ADD COLUMN IF NOT EXISTS name_fragment VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_tiger_states_abbreviation ON tiger_states(state_abbreviation);
CREATE INDEX IF NOT EXISTS idx_tiger_states_population ON tiger_states(population);
```

### ALTER TABLE tiger_counties
```sql
ALTER TABLE tiger_counties ADD COLUMN IF NOT EXISTS population BIGINT;
ALTER TABLE tiger_counties ADD COLUMN IF NOT EXISTS county_name_fragment VARCHAR(255);
ALTER TABLE tiger_counties ADD COLUMN IF NOT EXISTS pct_of_state_population DECIMAL(10,8);
CREATE INDEX IF NOT EXISTS idx_tiger_counties_population ON tiger_counties(population);
CREATE INDEX IF NOT EXISTS idx_tiger_counties_state_pop ON tiger_counties(state_fips, population);
```

### ALTER TABLE tiger_zcta
```sql
ALTER TABLE tiger_zcta ADD COLUMN IF NOT EXISTS population BIGINT;
ALTER TABLE tiger_zcta ADD COLUMN IF NOT EXISTS default_city VARCHAR(255);
ALTER TABLE tiger_zcta ADD COLUMN IF NOT EXISTS default_state VARCHAR(2);
CREATE INDEX IF NOT EXISTS idx_tiger_zcta_population ON tiger_zcta(population);
CREATE INDEX IF NOT EXISTS idx_tiger_zcta_state ON tiger_zcta(default_state);
```

## Data Transformations

### 1. LSAD Conversion (Metro Areas)
```typescript
function convertLSAD(type: string): string {
  if (type === 'Metropolitan Statistical Area') return 'M1';
  if (type === 'Micropolitan Statistical Area') return 'M2';
  return null;
}
```

### 2. FIPS Code Normalization
```typescript
// Ensure proper zero-padding
function normalizeFIPS(fips: string, length: number): string {
  return fips.padStart(length, '0');
}

// State FIPS: 2 digits (e.g., "01", "02")
// County FIPS: 5 digits (e.g., "01001", "17031")
// CBSA Code: 5 digits (e.g., "35620", "16980")
// ZIP Code: 5 digits (e.g., "35004", "90210")
```

### 3. County Name Cleaning
```typescript
// Remove "County" suffix if present
function cleanCountyName(name: string): string {
  return name.replace(/\s+County$/i, '').trim();
}
```

### 4. Percentage Conversion
```typescript
// Convert percentage strings to decimals
function parsePercentage(percent: string | number): number {
  if (typeof percent === 'number') return percent;
  return parseFloat(percent) / 100; // If stored as "50.5" instead of "0.505"
}
```

## Data Quality Checks

### Pre-Import Validation
- [ ] Verify all CBSA codes are 5-digit numeric
- [ ] Verify all state FIPS codes are 2-digit
- [ ] Verify all county FIPS codes are 5-digit
- [ ] Verify all ZIP codes are 5-digit
- [ ] Check for duplicate GEOIDs within each file
- [ ] Validate population values (non-negative integers)
- [ ] Handle NULL/empty population values appropriately
- [ ] Validate percentage values (0-1 or 0-100 range)

### Post-Import Validation
- [ ] Verify row counts match expected values
- [ ] Check referential integrity (counties → states, ZIPs → counties)
- [ ] Validate population totals (county populations should sum to state populations approximately)
- [ ] Verify junction table relationships (ZIP-county, ZIP-CBSA)
- [ ] Check for orphaned records (ZIPs without counties, counties without states)

## File Statistics Summary

| File | Rows | Key Columns | Relationships |
|------|------|-------------|---------------|
| Metro Areas.csv | 936 | 4 | CBSA definitions |
| States.csv | 60 | 5 | State definitions |
| County to State.csv | 3,244 | 8 | County definitions + State links |
| County to ZIP.csv | 54,554 | 8 | County → ZIP (many-to-many) |
| Metro to ZIP Code.csv | 35,988 | 8 | CBSA → ZIP (many-to-many) |
| ZIP Code Demographics.csv | 33,764 | 200+ | ZIP demographics |
| Zip to County.csv | 54,554 | 9 | ZIP → County (many-to-many) |
| ZIP to State, Town, Metro.csv | 39,494 | 7 | ZIP primary relationships |

**Total Records:** ~222,594 rows across all files

## Next Steps

1. **Review and approve schema changes** (add population and metadata fields)
2. **Create data import script** with validation and error handling
3. **Test import with sample data** before full import
4. **Build relationships** in junction tables
5. **Update geo_hierarchy table** with new population data
6. **Create indexes** for performance on population queries
7. **Validate data integrity** after import

## See Also

- Quick Reference: `scripts/CSV-GEOGRAPHY-QUICK-REFERENCE.md`
- Database schema: `scripts/schema-all-columns.txt`
- Geographic hierarchy design: `GEOGRAPHIC-HIERARCHY-DESIGN.md`

