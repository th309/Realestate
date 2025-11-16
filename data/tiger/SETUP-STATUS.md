# Geographic Relationship System - Setup Status

## ✅ Completed

1. **Database Tables Created**
   - `tiger_states` - State boundaries
   - `tiger_counties` - County boundaries  
   - `tiger_cbsa` - Metropolitan/Micropolitan Statistical Areas
   - `tiger_places` - City/Town boundaries
   - `tiger_zcta` - ZIP Code Tabulation Areas

2. **Junction Tables Created**
   - `geo_zip_county` - ZIP to County relationships
   - `geo_zip_place` - ZIP to Place relationships
   - `geo_zip_cbsa` - ZIP to CBSA relationships
   - `geo_place_county` - Place to County relationships
   - `geo_county_cbsa` - County to CBSA relationships
   - `geo_county_state` - County to State relationships

3. **Helper Functions Created**
   - `calculate_overlap_percentage()` - Calculates spatial overlap percentages
   - `update_tiger_geoids()` - Updates GEOID fields after shapefile loading

4. **Spatial Indexes Created**
   - GIST indexes on all geometry columns for fast spatial queries

## 📋 Next Steps

### Step 1: Load TIGER Shapefiles

Run the PowerShell script to load shapefiles using ogr2ogr:

```powershell
cd "C:\Projects\Real Estate\data\tiger"
.\load-tiger-shapefiles.ps1 -ProjectRef pysflbhpnqwoczyuaaif
```

**Requirements:**
- GDAL/OGR2OGR installed (`choco install gdal` or download from gdal.org)
- Supabase database password
- Shapefiles in the `data/tiger` directory

**This will load:**
- States (1 file)
- Counties (1 file)
- CBSA (1 file)
- ZCTA (1 file)
- Places (51 files - may need to merge)

### Step 2: Update GEOID Fields

After loading, run this SQL to update GEOID fields:

```sql
SELECT update_tiger_geoids();
```

This extracts the correct GEOID values from the loaded data.

### Step 3: Extract Names

Update name fields from the loaded shapefile attributes:

```sql
-- Update state names (adjust column name based on ogr2ogr output)
UPDATE tiger_states SET name = NAME WHERE name IS NULL;

-- Update county names
UPDATE tiger_counties SET name = NAME WHERE name IS NULL;

-- Update CBSA names
UPDATE tiger_cbsa SET name = NAME WHERE name IS NULL;

-- Update place names
UPDATE tiger_places SET name = NAME WHERE name IS NULL;
```

### Step 4: Calculate Relationships

**⚠️ WARNING: This will take HOURS for the full dataset!**

Run the relationship calculations. You can run them in batches:

```sql
-- ZIP to County (this is the largest - ~33,000 ZIPs × ~3,000 counties = 99M potential comparisons)
-- Use spatial index to filter first
INSERT INTO geo_zip_county (zip_geoid, county_geoid, overlap_percentage, overlap_area_sqkm, is_primary)
SELECT 
    z.geoid as zip_geoid,
    c.geoid as county_geoid,
    calculate_overlap_percentage(z.geometry, c.geometry) as overlap_percentage,
    ST_Area(ST_Transform(ST_Intersection(z.geometry, c.geometry), 3857)) / 1000000 as overlap_area_sqkm,
    CASE 
        WHEN calculate_overlap_percentage(z.geometry, c.geometry) > 50 THEN true
        ELSE false
    END as is_primary
FROM tiger_zcta z
CROSS JOIN tiger_counties c
WHERE ST_Intersects(z.geometry, c.geometry)
  AND ST_Area(ST_Intersection(z.geometry, c.geometry)) > 0
ON CONFLICT (zip_geoid, county_geoid) DO UPDATE SET
    overlap_percentage = EXCLUDED.overlap_percentage,
    overlap_area_sqkm = EXCLUDED.overlap_area_sqkm,
    is_primary = EXCLUDED.is_primary;
```

**Performance Tips:**
- Process in batches by state
- Use bounding box pre-filtering
- Run during off-peak hours
- Consider using a more powerful database instance

### Step 5: Build Hierarchy Table

After relationships are calculated, build the hierarchy table:

```sql
-- Run the entire build-geo-hierarchy-table.sql script
```

This creates the denormalized `geo_hierarchy` table for fast lookups.

## 📊 Expected Results

After completion, you should have:

- **~50 states** in `tiger_states`
- **~3,000 counties** in `tiger_counties`
- **~900 CBSAs** in `tiger_cbsa`
- **~30,000 places** in `tiger_places`
- **~33,000 ZIP codes** in `tiger_zcta`

Relationship counts:
- **~33,000 ZIP-County relationships** (most ZIPs in 1-2 counties)
- **~100,000 ZIP-Place relationships** (many ZIPs span multiple places)
- **~33,000 ZIP-CBSA relationships** (most ZIPs in 1 CBSA)
- **~50,000 Place-County relationships** (places can span counties)
- **~3,000 County-CBSA relationships**

## 🔍 Validation Queries

After setup, run these to validate:

```sql
-- Check for ZIPs without county relationships
SELECT COUNT(*) as zips_without_county
FROM tiger_zcta z
LEFT JOIN geo_zip_county gzc ON z.geoid = gzc.zip_geoid
WHERE gzc.zip_geoid IS NULL;

-- Check for ZIPs with multiple primary counties (shouldn't happen)
SELECT zip_geoid, COUNT(*) as primary_count
FROM geo_zip_county
WHERE is_primary = true
GROUP BY zip_geoid
HAVING COUNT(*) > 1;

-- Check overlap percentages sum to ~100% for each ZIP
SELECT 
    zip_geoid,
    SUM(overlap_percentage) as total_overlap
FROM geo_zip_county
GROUP BY zip_geoid
HAVING SUM(overlap_percentage) < 95 OR SUM(overlap_percentage) > 105;
```

## 📝 Files Created

- `GEOGRAPHIC-HIERARCHY-STRATEGY.md` - Complete strategy document
- `build-geographic-relationships.sql` - SQL to build relationships
- `build-geo-hierarchy-table.sql` - SQL to build hierarchy table
- `load-tiger-shapefiles.ps1` - PowerShell script to load shapefiles
- `setup-geographic-system.ps1` - Master orchestration script
- `README-GEOGRAPHIC-RELATIONSHIPS.md` - Usage documentation

## 🚀 Quick Start

Once shapefiles are loaded:

1. Update GEOIDs: `SELECT update_tiger_geoids();`
2. Extract names from shapefile attributes
3. Run relationship calculations (be patient!)
4. Build hierarchy table
5. Validate results

## 💡 Tips

- **Start small**: Test with one state first
- **Monitor progress**: Check row counts as you go
- **Use transactions**: Wrap in transactions for rollback capability
- **Batch processing**: Process relationships in chunks
- **Index maintenance**: VACUUM ANALYZE after large inserts

