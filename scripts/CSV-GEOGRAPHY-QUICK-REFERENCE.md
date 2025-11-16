# CSV Geography Files - Quick Reference

## File Summary

| # | File | Rows | Key Fields | Primary Key | Purpose |
|---|------|------|------------|-------------|---------|
| 1 | **Metro Areas.csv** | 936 | CBSA Code, Name, Type, Population | CBSA Code (5-digit) | CBSA definitions |
| 2 | **States.csv** | 60 | FIPS, Abbreviation, Name, Population | FIPS (2-digit) | State definitions |
| 3 | **County to State.csv** | 3,244 | FIPS Code, County, State, Population | FIPS Code (5-digit) | County definitions |
| 4 | **County to ZIP.csv** | 54,554 | County Code, ZIP, Percentage | County FIPS + ZIP | County→ZIP relationships |
| 5 | **Metro to ZIP Code.csv** | 35,988 | CBSA Code, ZIP, Percentage | CBSA Code + ZIP | Metro→ZIP relationships |
| 6 | **ZIP Code Demographics.csv** | 33,764 | ZIP, 200+ demographic fields | ZIP Code (5-digit) | ZIP demographics |
| 7 | **Zip to County.csv** | 54,554 | ZIP, County Code, Percentage | ZIP + County FIPS | ZIP→County relationships |
| 8 | **ZIP to State, Town, Metro.csv** | 39,494 | ZIP, State, Town, Metro, CBSA Code | ZIP Code (5-digit) | ZIP primary relationships |

## Database Mapping

### Metro Areas → `tiger_cbsa`
```
CBSA Code → geoid (VARCHAR(5))
Name (CSBA) → name (VARCHAR(255))
Metropolitan/Micropolitan → lsad (convert: "Metropolitan"→"M1", "Micropolitan"→"M2")
Population → population (BIGINT) [NEEDS COLUMN]
```

### States → `tiger_states`
```
FIPS code → geoid (VARCHAR(2))
State Name → name (VARCHAR(100))
State Abbreviation → state_abbreviation (VARCHAR(2)) [NEEDS COLUMN]
Population → population (BIGINT) [NEEDS COLUMN]
State Name Fragment → name_fragment (VARCHAR(100)) [NEEDS COLUMN]
```

### Counties → `tiger_counties`
```
FIPS - County Code → geoid (VARCHAR(5))
County → name (VARCHAR(100))
State FIPS (first 2 digits) → state_fips (VARCHAR(2))
County Population → population (BIGINT) [NEEDS COLUMN]
County Name Fragment → county_name_fragment (VARCHAR(255)) [NEEDS COLUMN]
County % of State → pct_of_state_population (DECIMAL) [NEEDS COLUMN]
```

## Data Transformations Needed

### 1. LSAD Conversion (Metro Areas)
```typescript
function convertLSAD(type: string): string {
  if (type === 'Metropolitan Statistical Area') return 'M1';
  if (type === 'Micropolitan Statistical Area') return 'M2';
  return null;
}
```

### 2. FIPS Code Validation
```typescript
// Ensure proper zero-padding
function normalizeFIPS(fips: string, length: number): string {
  return fips.padStart(length, '0');
}

// State FIPS: 2 digits (e.g., "01", "02")
// County FIPS: 5 digits (e.g., "01001", "17031")
// CBSA Code: 5 digits (e.g., "35620", "16980")
```

### 3. County Name Cleaning
```typescript
// Remove "County" suffix if present
function cleanCountyName(name: string): string {
  return name.replace(/\s+County$/i, '').trim();
}
```

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

## Data Quality Notes

### Empty Values
- **Metro Areas**: 10 Puerto Rico entries have empty population
- **States**: 7 territories have empty population
- **Counties**: All have population data

### Special Cases
- Puerto Rico entries in Metro Areas.csv (rows 927-936)
- Territories in States.csv (VI, GU, AS, FM, MH, MP, PW)
- Some CBSA names include state abbreviations: "New York-Newark-Jersey City, NY-NJ"

## Import Order

1. **States** (foundation - counties reference states)
2. **Counties** (references states via state_fips)
3. **CBSA** (can be imported independently, but relationships built later)

## Relationship Building

After import, build relationships:
- `geo_county_cbsa` - Many-to-many (requires spatial queries or additional data)
- `geo_hierarchy` - Update with population data

## Additional Files Analysis

### 4. County to ZIP.csv → `geo_zip_county`
- County perspective of ZIP-County relationships
- Maps to `geo_zip_county` junction table
- `county_geoid` = County Code, `zip_geoid` = ZIP, `overlap_percentage` = % of County Residents in ZIP

### 5. Metro to ZIP Code.csv → `geo_zip_cbsa`
- Metro perspective of ZIP-CBSA relationships
- Maps to `geo_zip_cbsa` junction table
- `cbsa_geoid` = CBSA Code, `zip_geoid` = ZIP, `overlap_percentage` = % of Metro Residents in ZIP

### 6. ZIP Code Demographics.csv → `census_demographics`
- Comprehensive demographic data (200+ fields)
- Maps to `census_demographics` table
- Includes age, race, ethnicity, income, housing, education, etc.

### 7. Zip to County.csv → `geo_zip_county`
- ZIP perspective of ZIP-County relationships (reverse of County to ZIP.csv)
- Maps to `geo_zip_county` junction table
- Shows which counties a ZIP spans with percentages

### 8. ZIP to State, Town, Metro.csv → Multiple tables
- Primary relationships for each ZIP
- Maps to `tiger_zcta` (population, default_city, default_state)
- Maps to `geo_zip_cbsa` (primary CBSA relationship)

## Import Order

1. **States** (foundation)
2. **Counties** (references states)
3. **CBSA** (independent)
4. **ZIP Codes** (references counties/states)
5. **Junction Tables** (ZIP-County, ZIP-CBSA)
6. **Demographics** (references ZIPs)

## See Also

- Complete analysis: `scripts/CSV-GEOGRAPHY-COMPLETE-ANALYSIS.md`
- Original analysis: `scripts/CSV-GEOGRAPHY-MAPPING-ANALYSIS.md`
- Database schema: `scripts/schema-all-columns.txt`
- Geographic hierarchy design: `GEOGRAPHIC-HIERARCHY-DESIGN.md`

