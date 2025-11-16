# Geographic Mapping Strategy

## Core Principle
**All data must map to exactly 4 geographic levels that align with Mapbox shapefiles:**
1. **State** (50 states + DC)
2. **Metro** (Metropolitan Statistical Areas - ~380 in US)
3. **City** (Incorporated places - ~30,000 in US)
4. **Zip Code** (ZIP Code Tabulation Areas - ~33,000 in US)

## The Mapping Challenge

Each data source uses different geographic identifiers:

| Source | State | Metro | City | Zip |
|--------|-------|-------|------|-----|
| **Mapbox** | State boundaries | MSA boundaries | Place boundaries | ZCTA boundaries |
| **Zillow** | RegionID + "state" | RegionID + "msa" | RegionID + "city" | RegionID + "zip" |
| **Redfin** | State name | "Boston, MA metro area" | "Boston, MA" | ZIP codes |
| **Census** | FIPS state code (36) | MSA code (35620) | Place code (3651000) | ZCTA (10001) |
| **FRED** | Some state series | Limited metro series | N/A | N/A |

## Mapping Rules by Source

### 1. Zillow → Our System
```sql
-- Zillow provides RegionType field that maps directly
CASE zillow.RegionType
    WHEN 'state' THEN 'state'
    WHEN 'msa' THEN 'metro'  -- MSA = Metropolitan Statistical Area
    WHEN 'city' THEN 'city'
    WHEN 'zip' THEN 'zip'
    -- Ignore: 'country', 'county', 'neighborhood'
END
```

### 2. Redfin → Our System
```sql
-- Redfin uses descriptive names
IF name LIKE '%metro area%' THEN 'metro'
ELSIF name LIKE '%,%' AND length < 50 THEN 'city'  -- "Boston, MA"
ELSIF name ~ '^\d{5}$' THEN 'zip'
ELSIF name IN (state_list) THEN 'state'
```

### 3. Census → Our System
```sql
-- Census uses different geographic codes
IF geo_type = 'state' THEN 'state'
ELSIF geo_type = 'metropolitan statistical area/micropolitan statistical area' THEN 'metro'
ELSIF geo_type = 'place' THEN 'city'
ELSIF geo_type = 'zip code tabulation area' THEN 'zip'
```

### 4. FRED → Our System
```sql
-- FRED is mostly national, some state/metro
-- Most FRED data applies to ALL regions (e.g., mortgage rates)
-- State-specific series map to 'state'
-- MSA-specific series map to 'metro'
```

## Implementation Steps

### Step 1: Load Mapbox Geography First
```typescript
// 1. Import Mapbox shapefiles to establish geographic truth
await loadMapboxShapefile('states.geojson', 'state');
await loadMapboxShapefile('metros.geojson', 'metro');
await loadMapboxShapefile('cities.geojson', 'city');
await loadMapboxShapefile('zipcodes.geojson', 'zip');

// Each import creates a markets record with:
// - region_id (our internal ID)
// - region_name (from Mapbox)
// - region_type (state/metro/city/zip)
// - geometry (from shapefile)
// - centroid_lat/lon (calculated)
// - bounds (calculated)
```

### Step 2: Map External IDs
```typescript
// After loading Mapbox, map external identifiers

// Zillow mapping
UPDATE markets SET zillow_id = '394913' 
WHERE region_name = 'New York-Newark-Jersey City' 
AND region_type = 'metro';

// Census mapping
UPDATE markets SET census_id = '35620'
WHERE region_name = 'New York-Newark-Jersey City'
AND region_type = 'metro';

// Redfin mapping
UPDATE markets SET redfin_id = 'New York, NY metro area'
WHERE region_name = 'New York-Newark-Jersey City'
AND region_type = 'metro';
```

### Step 3: Import Data Using Mappings
```typescript
// When importing Zillow data
const zillow_region_id = row.RegionID;
const our_region = await db.query(
    'SELECT region_id FROM markets WHERE zillow_id = $1',
    [zillow_region_id]
);

if (!our_region) {
    // Log unmapped region for manual review
    console.warn(`Unmapped Zillow region: ${row.RegionName} (${zillow_region_id})`);
    return;
}

// Insert time series data
await db.query(
    'INSERT INTO market_time_series (region_id, date, metric_name, metric_value, data_source) VALUES ($1, $2, $3, $4, $5)',
    [our_region.region_id, date, 'zhvi', value, 'zillow']
);
```

## Handling Mismatches

### Problem 1: Geographic Boundary Differences
- **Issue**: Zillow's "metro" might differ from Census MSA boundaries
- **Solution**: Use Mapbox boundaries as truth, map to closest match
- **Flag**: Mark confidence level when boundaries don't align perfectly

### Problem 2: Missing Geographies
- **Issue**: Some Zillow cities might not exist in Mapbox cities
- **Solution**: 
  1. Map to parent metro if city not found
  2. Log for manual review
  3. Consider adding to Mapbox if significant

### Problem 3: Name Variations
- **Issue**: "NYC" vs "New York City" vs "New York"
- **Solution**: Fuzzy matching with confirmation
```sql
-- Use PostgreSQL's similarity function
SELECT region_id, region_name, similarity(region_name, 'New York') as score
FROM markets
WHERE region_type = 'city'
AND similarity(region_name, 'New York') > 0.3
ORDER BY score DESC;
```

### Problem 4: Historical Changes
- **Issue**: ZIP codes change, metros get redefined
- **Solution**: Version geographic definitions by date range

## Data Quality Rules

### Required Mappings
Each geographic level should have:
- **State**: Must map to all sources (all have state data)
- **Metro**: Must map to Zillow + Redfin + Census
- **City**: Should map to Zillow + Census (Redfin optional)
- **Zip**: Should map to Zillow + Census (others optional)

### Validation Checks
```sql
-- Check mapping coverage
SELECT 
    region_type,
    COUNT(*) as total,
    SUM(CASE WHEN zillow_id IS NOT NULL THEN 1 ELSE 0 END) as has_zillow,
    SUM(CASE WHEN redfin_id IS NOT NULL THEN 1 ELSE 0 END) as has_redfin,
    SUM(CASE WHEN census_id IS NOT NULL THEN 1 ELSE 0 END) as has_census
FROM markets
GROUP BY region_type;

-- Find unmapped regions with data
SELECT DISTINCT 
    source_region_id,
    source_region_name,
    data_source
FROM import_staging
WHERE mapped_region_id IS NULL
ORDER BY data_source, source_region_name;
```

## Practical Workflow

### 1. Initial Setup (One Time)
```bash
# 1. Load Mapbox shapefiles
npm run load-mapbox-geography

# 2. Create ID mapping table
npm run create-id-mappings

# 3. Validate mappings
npm run validate-geography
```

### 2. Data Import (Regular)
```bash
# Import with automatic mapping
npm run import-zillow  # Uses zillow_id mapping
npm run import-redfin  # Uses name matching
npm run import-census  # Uses census_id mapping
npm run import-fred    # Applies to all regions
```

### 3. Manual Review (As Needed)
```bash
# Review unmapped regions
npm run review-unmapped

# Add new mappings
npm run add-mapping --source=zillow --id=123456 --region=city_boston

# Refresh map data
npm run refresh-map-view
```

## Benefits of This Approach

1. **Simplicity**: Only 4 geographic types to manage
2. **Consistency**: Mapbox shapes are the single source of truth
3. **Flexibility**: Each source maintains its own ID system
4. **Scalability**: Easy to add new data sources
5. **Map-Ready**: Direct alignment with Mapbox rendering

## Next Steps

1. **Obtain Mapbox shapefiles** for all 4 geographic levels
2. **Load shapes into database** with proper IDs and names
3. **Create mapping table** linking external IDs to our regions
4. **Update importers** to use mapping lookup
5. **Build validation reports** to track unmapped data
6. **Create manual mapping UI** for edge cases
