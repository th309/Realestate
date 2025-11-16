# Geographic Table Consolidation Plan

## Goal
Minimize tables for clarity while maintaining geographic hierarchy and data mapping during imports.

## Current State

### Redundant Tables
1. **`geo_data`** - Original plan table (geo_code, geo_name, geo_type, geometry)
   - Used only for test data
   - Referenced by: `time_series_data`, `current_scores`, `user_favorites`

2. **`markets`** - Harmonization table (region_id, region_name, region_type, external_ids JSONB)
   - Used for real data (Zillow, Redfin, Census, FRED)
   - Has `external_ids` JSONB for mapping multiple source IDs

3. **`tiger_*` tables** - TIGER shapefile data (tiger_states, tiger_counties, tiger_cbsa, tiger_places, tiger_zcta)
   - Required for PostGIS spatial queries
   - Contains official Census geometries

4. **`geo_hierarchy`** - Denormalized hierarchy table
   - Fast lookups for geographic relationships
   - Links TIGER GEOIDs to hierarchy

### Junction Tables (Keep)
- `geo_zip_county`, `geo_zip_place`, `geo_zip_cbsa`, `geo_place_county`, `geo_county_cbsa`, `geo_county_state`
- Required for many-to-many spatial relationships

## Consolidated Design

### Core Tables (Keep)

1. **`markets`** - Single source of truth for all geographic entities
   - Stores Zillow, Redfin, Census, FRED data
   - Links to TIGER tables via GEOID in `external_ids`
   - Has geometry for mapping

2. **`tiger_*` tables** - TIGER shapefile geometries
   - `tiger_states`, `tiger_counties`, `tiger_cbsa`, `tiger_places`, `tiger_zcta`
   - Required for PostGIS spatial operations
   - Source of truth for official boundaries

3. **`geo_hierarchy`** - Fast hierarchy lookups
   - Denormalized from TIGER relationships
   - Used for quick parent/child queries

4. **Junction tables** - Spatial relationships
   - Many-to-many relationships between TIGER entities

### Tables to Delete

1. **`geo_data`** - Redundant with `markets`
   - Migrate any data to `markets`
   - Update foreign keys

## Migration Strategy

### Step 1: Enhance `markets` Table

Add fields to link to TIGER tables:
```sql
-- Add GEOID field for linking to TIGER tables
ALTER TABLE markets ADD COLUMN IF NOT EXISTS geoid VARCHAR(20);
CREATE INDEX IF NOT EXISTS idx_markets_geoid ON markets(geoid);

-- Ensure external_ids can store TIGER GEOIDs
-- external_ids already exists as JSONB, we'll use it like:
-- {"tiger_state_geoid": "17", "tiger_county_geoid": "17031", "tiger_cbsa_geoid": "16980", ...}
```

### Step 2: Migrate Data from `geo_data` to `markets`

```sql
-- Migrate geo_data records to markets
INSERT INTO markets (region_id, region_name, region_type, state_code, geometry, bounds, created_at)
SELECT 
    geo_code as region_id,
    geo_name as region_name,
    geo_type as region_type,
    CASE 
        WHEN geo_code LIKE 'US-%' THEN SPLIT_PART(geo_code, '-', 2)
        ELSE NULL
    END as state_code,
    geometry,
    bounds,
    created_at
FROM geo_data
ON CONFLICT (region_id) DO NOTHING;
```

### Step 3: Update Foreign Keys

```sql
-- Update time_series_data to reference markets instead of geo_data
ALTER TABLE time_series_data 
    DROP CONSTRAINT IF EXISTS time_series_data_geo_code_fkey,
    ADD CONSTRAINT time_series_data_region_id_fkey 
        FOREIGN KEY (geo_code) REFERENCES markets(region_id);

-- Update current_scores to reference markets
ALTER TABLE current_scores 
    DROP CONSTRAINT IF EXISTS current_scores_geo_code_fkey,
    ADD CONSTRAINT current_scores_region_id_fkey 
        FOREIGN KEY (geo_code) REFERENCES markets(region_id);

-- Update user_favorites to reference markets
ALTER TABLE user_favorites 
    DROP CONSTRAINT IF EXISTS user_favorites_geo_code_fkey,
    ADD CONSTRAINT user_favorites_region_id_fkey 
        FOREIGN KEY (geo_code) REFERENCES markets(region_id);

-- Update price_alerts to reference markets
ALTER TABLE price_alerts 
    DROP CONSTRAINT IF EXISTS price_alerts_geo_code_fkey,
    ADD CONSTRAINT price_alerts_region_id_fkey 
        FOREIGN KEY (geo_code) REFERENCES markets(region_id);
```

### Step 4: Update Code References

Update all code that references `geo_data` to use `markets`:
- `geo_code` → `region_id`
- `geo_name` → `region_name`
- `geo_type` → `region_type`

### Step 5: Delete `geo_data` Table

```sql
-- After verifying all data is migrated and code is updated
DROP TABLE IF EXISTS geo_data CASCADE;
```

## Linking Markets to TIGER Tables

### Strategy

Store TIGER GEOIDs in `markets.external_ids` JSONB:
```json
{
  "zillow_id": "394913",
  "tiger_state_geoid": "17",
  "tiger_county_geoid": "17031",
  "tiger_cbsa_geoid": "16980",
  "tiger_place_geoid": "1714000",
  "tiger_zcta_geoid": "60007",
  "census_msa": "35620",
  "fips_code": "36061"
}
```

### Helper Functions

Create functions to link markets to TIGER tables:
```sql
-- Function to get TIGER geometry for a market
CREATE OR REPLACE FUNCTION get_tiger_geometry(market_region_id VARCHAR(50))
RETURNS GEOMETRY AS $$
DECLARE
    tiger_geoid VARCHAR(20);
    tiger_type VARCHAR(20);
    result GEOMETRY;
BEGIN
    -- Extract TIGER GEOID from external_ids
    SELECT 
        external_ids->>'tiger_state_geoid',
        'state'
    INTO tiger_geoid, tiger_type
    FROM markets
    WHERE region_id = market_region_id;
    
    -- Query appropriate TIGER table
    IF tiger_type = 'state' THEN
        SELECT geometry INTO result FROM tiger_states WHERE geoid = tiger_geoid;
    ELSIF tiger_type = 'county' THEN
        SELECT geometry INTO result FROM tiger_counties WHERE geoid = tiger_geoid;
    -- ... etc
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;
```

## Benefits

1. **Single Source of Truth**: `markets` table for all geographic entities
2. **Maintains Hierarchy**: TIGER tables + `geo_hierarchy` for relationships
3. **Preserves Mapping**: `external_ids` JSONB stores all source IDs
4. **Spatial Queries**: TIGER tables provide PostGIS capabilities
5. **Simplified Code**: One table (`markets`) instead of two (`geo_data` + `markets`)

## Implementation Order

1. ✅ Create migration script
2. ✅ Enhance `markets` table
3. ✅ Migrate data from `geo_data`
4. ✅ Update foreign keys
5. ✅ Update code references
6. ✅ Delete `geo_data` table
7. ✅ Test all imports still work

