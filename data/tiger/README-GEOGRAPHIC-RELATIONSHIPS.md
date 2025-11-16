# Geographic Relationship System

## Overview

This system handles the complex many-to-many relationships between geographic entities in TIGER shapefiles. For example, ZIP code 60007 belongs to:
- Chicago metro area (CBSA)
- Illinois state
- Multiple counties (potentially)
- Multiple places/cities (potentially)

## Architecture

### 1. Core Tables
Each TIGER shapefile is loaded into its own table:
- `tiger_states` - State boundaries
- `tiger_counties` - County boundaries
- `tiger_cbsa` - Metropolitan/Micropolitan Statistical Areas
- `tiger_places` - City/Town boundaries
- `tiger_zcta` - ZIP Code Tabulation Areas

### 2. Junction Tables
Many-to-many relationships are stored in junction tables with overlap percentages:
- `geo_zip_county` - ZIP to County relationships
- `geo_zip_place` - ZIP to Place relationships
- `geo_zip_cbsa` - ZIP to CBSA relationships
- `geo_place_county` - Place to County relationships
- `geo_county_cbsa` - County to CBSA relationships
- `geo_county_state` - County to State relationships

### 3. Hierarchy Table
Denormalized table for fast lookups:
- `geo_hierarchy` - Contains all geographic entities with their relationships

## Key Concepts

### Overlap Percentage
When a ZIP code spans multiple counties, we calculate what percentage of the ZIP is in each county:
- ZIP 60007 might be 80% in County A, 20% in County B
- The `overlap_percentage` field stores this value
- The `is_primary` flag is true if overlap > 50%

### Primary Relationships
For most queries, you want the "primary" relationship (where overlap > 50%):
- Each ZIP should have exactly one primary county
- Each ZIP should have exactly one primary state
- Each ZIP may have zero or one primary place
- Each ZIP may have zero or one primary CBSA

### All Relationships
For comprehensive queries, you can access all relationships:
- A ZIP might be in 2 counties (80% + 20%)
- A place might span 3 counties
- A CBSA might span multiple states

## Usage Examples

### Get all counties for a ZIP code
```sql
SELECT c.*, gzc.overlap_percentage, gzc.is_primary
FROM tiger_counties c
JOIN geo_zip_county gzc ON c.geoid = gzc.county_geoid
WHERE gzc.zip_geoid = '60007'
ORDER BY gzc.is_primary DESC, gzc.overlap_percentage DESC;
```

### Get full hierarchy for a ZIP code (fast lookup)
```sql
SELECT *
FROM geo_hierarchy_full
WHERE geoid = '60007';
```

### Find all ZIPs in a CBSA
```sql
SELECT z.*
FROM tiger_zcta z
JOIN geo_zip_cbsa gzc ON z.geoid = gzc.zip_geoid
WHERE gzc.cbsa_geoid = '16980'  -- Chicago
  AND gzc.is_primary = true;
```

### Get hierarchy path
```sql
SELECT hierarchy_path
FROM geo_hierarchy
WHERE geoid = '60007';
-- Returns: ["US", "17", "16980", "1714000", "60007"]
--          [National, Illinois, Chicago CBSA, Place, ZIP]
```

### Find all ZIPs in a state
```sql
SELECT z.*
FROM tiger_zcta z
JOIN geo_zip_county gzc ON z.geoid = gzc.zip_geoid
JOIN geo_county_state gcs ON gzc.county_geoid = gcs.county_geoid
WHERE gcs.state_geoid = '17'  -- Illinois
  AND gzc.is_primary = true;
```

## Implementation Steps

1. **Load TIGER shapefiles** into their respective tables
2. **Create spatial indexes** on all geometry columns
3. **Run `build-geographic-relationships.sql`** to:
   - Create junction tables
   - Calculate spatial relationships
   - Populate overlap percentages
4. **Run `build-geo-hierarchy-table.sql`** to:
   - Create hierarchy table
   - Populate with denormalized data
5. **Validate** using the validation queries in the scripts

## Performance Considerations

### Spatial Indexes
All geometry columns should have GIST indexes:
```sql
CREATE INDEX idx_tiger_zcta_geometry ON tiger_zcta USING GIST(geometry);
CREATE INDEX idx_tiger_counties_geometry ON tiger_counties USING GIST(geometry);
-- etc.
```

### Batch Processing
Spatial relationship calculations are expensive. Process in batches:
- Process ZIPs in chunks of 1000
- Use bounding box pre-filtering
- Consider running during off-peak hours

### Caching
The `geo_hierarchy` table is a denormalized cache. Update it when:
- New TIGER data is loaded
- Relationships change
- Data corrections are made

## Edge Cases Handled

1. **ZIP codes spanning state boundaries** - Stored in `all_states` JSONB array
2. **Places spanning multiple counties** - Multiple rows in `geo_place_county`
3. **CBSAs spanning multiple states** - Stored in `all_states` JSONB array
4. **ZIP codes with no place** - `primary_place_geoid` will be NULL
5. **Partial overlaps** - Stored with `overlap_percentage` < 50%

## Validation

After building relationships, run validation queries:
- Every ZIP should have at least one county relationship
- Every ZIP should have at least one state relationship
- Overlap percentages should sum to ~100% for each ZIP
- Primary relationships should be unique per ZIP

## Maintenance

### Updating Relationships
When new TIGER data is released:
1. Reload shapefiles
2. Re-run relationship calculations
3. Rebuild hierarchy table
4. Validate results

### Adding New Geographic Levels
To add a new geographic level (e.g., Census Tracts):
1. Create table: `tiger_tracts`
2. Create junction tables: `geo_zip_tract`, `geo_tract_county`, etc.
3. Update `geo_hierarchy` table to include new level
4. Re-run all relationship calculations

## Query Performance Tips

1. **Use primary relationships** for most queries (faster)
2. **Use hierarchy table** for simple lookups (fastest)
3. **Use junction tables** for complex queries with filters
4. **Filter by state first** to reduce dataset size
5. **Use spatial indexes** for geometry-based queries

## Example: Complete Hierarchy for ZIP 60007

```
National (US)
  └── Illinois (17)
      └── Chicago-Naperville-Elgin, IL-IN-WI Metro Area (16980)
          └── Elgin, IL (1714000) [Place]
              └── 60007 [ZIP]
                  ├── Cook County (17031) [80%]
                  └── Kane County (17089) [20%]
```

This is stored as:
- `hierarchy_path`: ["US", "17", "16980", "1714000", "60007"]
- `primary_county_geoid`: "17031" (Cook County - 80% overlap)
- `all_counties`: ["17031", "17089"]
- `primary_cbsa_geoid`: "16980" (Chicago metro)
- `primary_state_geoid`: "17" (Illinois)

