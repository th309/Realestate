# QGIS Setup for Loading CBSA Data to Supabase

## Step 1: Install QGIS

1. Download QGIS from: https://qgis.org/download/
2. Install the latest LTR (Long Term Release) version
3. Launch QGIS

## Step 2: Connect to Supabase Database

### Connection Details

1. In QGIS, go to: **Layer → Add Layer → Add PostgreSQL Layer...** (or press Ctrl+Shift+D)
2. In the dialog that opens, click **New** to create a new connection
3. Fill in the following details:

```
Name: Supabase Real Estate DB
Host: db.pysflbhpnqwoczyuaaif.supabase.co
Port: 6543 (IMPORTANT: Use 6543 for connection pooling, not 5432)
Database: postgres
Username: postgres
Password: Ihatedoingpt12
```

### Get Your Database Password

1. Go to: https://supabase.com/dashboard/project/pysflbhpnqwoczyuaaif/settings/database
2. Under "Connection parameters", find the **Database password**
3. If you don't see it, click "Reset database password" to generate a new one
4. Copy the password and paste it into QGIS

### SSL Settings

- Check **"Use estimated table metadata"** (optional, for faster loading)
- In the **SSL mode** dropdown, select: **"require"** or **"prefer"**

4. Click **Test Connection** to verify it works
5. Click **OK** to save the connection

## Step 3: Import CBSA Shapefile

### Method A: Using DB Manager (Recommended)

1. Go to: **Database → DB Manager**
2. In the left panel, expand your Supabase connection
3. Expand **Schemas → public**
4. Click the **Import Layer/File** button (icon with arrow pointing into database)
5. Configure the import:

   **General Tab:**
   - **Input**: Click **...** and browse to:
     ```
     C:\Projects\Real Estate\scripts\shapefiles\tl_2024_us_cbsa.shp
     ```
   - **Table**: `dim_geography_geometry_staging`
   - **Schema**: `public`
   - **Encoding**: `UTF-8`

   **Options Tab:**
   - **Source SRID**: `4326` (or leave blank, QGIS will detect)
   - **Target SRID**: `4326`
   - **Create spatial index**: ✓ Checked
   - **Convert field names to lowercase**: ✓ Checked (optional)
   - **Drop table if exists**: ✓ Checked (if re-running)

   **Advanced Tab:**
   - **Geometry column name**: `geom`
   - **Primary key**: Leave blank (or use `GEOID` if you want)

6. Click **OK** to start the import
7. Wait for the import to complete (may take a few minutes for 935 features)

### Method B: Using Processing Toolbox

1. Go to: **Processing → Toolbox**
2. Search for: **"Import into PostGIS"** or **"Import vector to Postgres"**
3. Configure:
   - **Input layer**: Browse to `tl_2024_us_cbsa.shp`
   - **Database**: Select your Supabase connection
   - **Schema**: `public`
   - **Table name**: `dim_geography_geometry_staging`
   - **Primary key**: Leave blank
   - **Geometry column**: `geom`
   - **SRID**: `4326`
4. Click **Run**

## Step 4: Verify the Import

1. In DB Manager, right-click on `dim_geography_geometry_staging`
2. Select **"View Data"** or **"Preview"**
3. You should see 935 rows
4. Check that the `geom` column has geometry data

## Step 5: Map to dim_geography_geometry

After importing, you need to copy the data to the actual table with proper geoid mapping:

### Option A: Using QGIS DB Manager SQL Window

1. In DB Manager, click the **SQL Window** button
2. Run this SQL:

```sql
-- Copy geometries to dim_geography_geometry, matching by GEOID
INSERT INTO dim_geography_geometry (geoid, geom)
SELECT 
    GEOID as geoid,
    geom
FROM dim_geography_geometry_staging
WHERE GEOID IN (SELECT geoid FROM dim_geography WHERE level = 'cbsa')
ON CONFLICT (geoid) 
DO UPDATE SET geom = EXCLUDED.geom;
```

3. Click **Execute** (F5)
4. Verify: `SELECT COUNT(*) FROM dim_geography_geometry;` should return 935

### Option B: Using Supabase SQL Editor

1. Go to: https://supabase.com/dashboard/project/pysflbhpnqwoczyuaaif/editor
2. Run the same SQL as above

## Step 6: Clean Up (Optional)

After verifying everything works:

```sql
-- Drop the staging table if no longer needed
DROP TABLE IF EXISTS dim_geography_geometry_staging;
```

## Troubleshooting

- **Connection refused**: Check that SSL mode is set to "require"
- **Authentication failed**: Verify your database password
- **Table already exists**: Use "Drop table if exists" option or manually drop it first
- **Geometry errors**: Ensure SRID is set to 4326
- **Slow import**: This is normal for large shapefiles; be patient

## Quick Reference

- **Shapefile location**: `C:\Projects\Real Estate\scripts\shapefiles\tl_2024_us_cbsa.shp`
- **Target table**: `dim_geography_geometry_staging` (then copy to `dim_geography_geometry`)
- **Geometry column**: `geom`
- **SRID**: `4326`
- **Expected rows**: 935 CBSAs

