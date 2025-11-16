# Loading CBSA Geography with ogr2ogr

## Prerequisites

1. **Install GDAL/OGR** (includes ogr2ogr):
   - **Windows (Chocolatey)**: `choco install gdal`
   - **Windows (Manual)**: Download from https://gdal.org/download.html
   - **macOS**: `brew install gdal`
   - **Linux**: `sudo apt-get install gdal-bin` (Ubuntu/Debian) or `sudo yum install gdal` (RHEL/CentOS)

2. **Get Supabase Database Password**:
   - Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/database
   - Copy the database password from "Connection parameters"
   - Or use the connection string directly

## Method 1: Using PowerShell Script (Windows)

```powershell
cd scripts
.\load-cbsa-with-ogr2ogr.ps1
```

The script will:
- Read your `.env.local` file
- Extract Supabase project details
- Prompt for database password
- Run ogr2ogr to load the shapefile

## Method 2: Using Bash Script (Linux/macOS/WSL)

```bash
cd scripts
chmod +x load-cbsa-ogr2ogr.sh
./load-cbsa-ogr2ogr.sh
```

## Method 3: Manual Command

After installing GDAL, run:

```bash
ogr2ogr -f PostgreSQL \
  "PG:host=db.YOUR_PROJECT.supabase.co dbname=postgres user=postgres password=YOUR_PASSWORD port=5432 sslmode=require" \
  shapefiles/tl_2024_us_cbsa.shp \
  -nln dim_geography_geometry_staging \
  -nlt PROMOTE_TO_MULTI \
  -lco GEOMETRY_NAME=geom \
  -t_srs EPSG:4326 \
  -overwrite
```

Replace:
- `YOUR_PROJECT` with your Supabase project reference (from NEXT_PUBLIC_SUPABASE_URL)
- `YOUR_PASSWORD` with your database password

## After Loading

1. **Verify the load**:
   ```sql
   SELECT COUNT(*) FROM dim_geography_geometry_staging;
   ```

2. **Map to dim_geography_geometry**:
   ```sql
   -- Insert geometries matching CBSA geoids
   INSERT INTO dim_geography_geometry (geoid, geom)
   SELECT 
     g.geoid,
     s.geom
   FROM dim_geography_geometry_staging s
   JOIN dim_geography g ON g.geoid = s.GEOID
   WHERE g.level = 'cbsa'
   ON CONFLICT (geoid) DO UPDATE SET geom = EXCLUDED.geom;
   ```

3. **Clean up staging table** (optional):
   ```sql
   DROP TABLE dim_geography_geometry_staging;
   ```

## Troubleshooting

- **"ogr2ogr: command not found"**: Install GDAL (see Prerequisites)
- **Connection refused**: Check your database password and host
- **SSL errors**: Ensure `sslmode=require` is in connection string
- **Table already exists**: Use `-overwrite` flag or drop table first








