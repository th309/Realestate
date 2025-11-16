# Loading TIGER Shapefiles - Instructions

## Prerequisites

### Option 1: Install GDAL (ogr2ogr) - Recommended

**Windows (Chocolatey):**
```powershell
# Install Chocolatey first if needed: https://chocolatey.org/install
choco install gdal --yes
```

**Windows (Manual):**
1. Download GDAL from: https://gdal.org/download.html
2. Or use OSGeo4W: https://trac.osgeo.org/osgeo4w/
3. Add to PATH: `C:\OSGeo4W64\bin` (or wherever GDAL is installed)

**Verify installation:**
```powershell
ogr2ogr --version
```

### Option 2: Use Python (Alternative)

If ogr2ogr is not available, you can use Python with GeoPandas:

```powershell
pip install geopandas psycopg2 sqlalchemy
```

Then use the Python script: `load-with-python.py`

## Loading Data

### Step 1: Run the Loading Script

```powershell
cd "C:\Projects\Real Estate\data\tiger"
.\load-all-geographic-data.ps1 -ProjectRef pysflbhpnqwoczyuaaif
```

You'll be prompted for your Supabase database password.

### Step 2: Update GEOID Fields

After loading, run this SQL in Supabase:

```sql
SELECT update_tiger_geoids();
```

### Step 3: Extract Names

Update name fields from the loaded attributes:

```sql
-- Update state names
UPDATE tiger_states 
SET name = COALESCE(NAME, NAMELSAD, name)
WHERE name IS NULL OR name = '';

-- Update county names
UPDATE tiger_counties 
SET name = COALESCE(NAME, NAMELSAD, name),
    state_fips = SUBSTRING(geoid, 1, 2)
WHERE name IS NULL OR name = '';

-- Update CBSA names
UPDATE tiger_cbsa 
SET name = COALESCE(NAME, NAMELSAD, name),
    lsad = COALESCE(LSAD, lsad)
WHERE name IS NULL OR name = '';

-- Update place names
UPDATE tiger_places 
SET name = COALESCE(NAME, NAMELSAD, name),
    state_fips = SUBSTRING(geoid, 1, 2)
WHERE name IS NULL OR name = '';

-- Update ZCTA (ZIP codes use GEOID as name)
UPDATE tiger_zcta 
SET geoid = COALESCE(geoid20, geoid, GEOID20)
WHERE geoid IS NULL OR geoid = '';
```

### Step 4: Verify Data

Check that data loaded correctly:

```sql
-- Count records
SELECT 'States' as type, COUNT(*) as count FROM tiger_states
UNION ALL
SELECT 'Counties', COUNT(*) FROM tiger_counties
UNION ALL
SELECT 'CBSA', COUNT(*) FROM tiger_cbsa
UNION ALL
SELECT 'Places', COUNT(*) FROM tiger_places
UNION ALL
SELECT 'ZCTA', COUNT(*) FROM tiger_zcta;

-- Check for missing names
SELECT 'States' as type, COUNT(*) as missing_names 
FROM tiger_states WHERE name IS NULL OR name = ''
UNION ALL
SELECT 'Counties', COUNT(*) FROM tiger_counties WHERE name IS NULL OR name = ''
UNION ALL
SELECT 'CBSA', COUNT(*) FROM tiger_cbsa WHERE name IS NULL OR name = ''
UNION ALL
SELECT 'Places', COUNT(*) FROM tiger_places WHERE name IS NULL OR name = '';
```

## Expected Results

After loading, you should have approximately:

- **50 states** (including DC)
- **3,143 counties**
- **~900 CBSAs** (Metropolitan + Micropolitan)
- **~30,000 places** (cities/towns)
- **~33,000 ZCTAs** (ZIP codes)

## Troubleshooting

### ogr2ogr not found
- Install GDAL (see Prerequisites above)
- Verify PATH includes GDAL bin directory
- Restart PowerShell after installation

### Connection errors
- Verify database password is correct
- Check Supabase project is active
- Ensure network connectivity

### Large file timeouts
- Shapefiles are large (ZCTA is 784 MB)
- Loading may take 10-30 minutes per large file
- Be patient, ogr2ogr shows progress

### Memory issues
- Close other applications
- Process files one at a time if needed
- Consider using a more powerful machine for large files

## Next Steps

After data is loaded:

1. ✅ Update GEOID fields
2. ✅ Extract names
3. ⏭️ Calculate relationships (run `build-geographic-relationships.sql`)
4. ⏭️ Build hierarchy table (run `build-geo-hierarchy-table.sql`)

