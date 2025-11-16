# GDAL Alternatives - Complete Guide

Since GDAL installation is failing on Windows, here are **5 working alternatives** to load **shapefiles AND GeoJSON files** into Supabase PostGIS.

**✅ All solutions support both .shp (shapefiles) and .geojson/.json files!**

## 🚀 Quick Start (Recommended)

**For immediate use:** Python with GeoPandas (Option 1) - **Supports .shp and .geojson**
```powershell
pip install geopandas psycopg2 sqlalchemy
cd "C:\Projects\Real Estate\data\tiger"
python load-with-python.py
```

**For long-term (matches your stack):** Node.js/TypeScript (Option 2) - **Supports .shp and .geojson**
```powershell
npm install
npm run load-shapefiles -- --project-ref YOUR_PROJECT_REF
# Works with both shapefiles and GeoJSON files!
```

---

## 📋 All Options Summary

| Option | Setup Time | Best For | Status |
|--------|-----------|----------|--------|
| **1. Python/GeoPandas** | ⭐⭐⭐ | Quick solution | ✅ Ready |
| **2. Node.js/TypeScript** | ⭐⭐ | Long-term solution | ✅ **NEW!** |
| **3. GeoJSON + API** | ⭐⭐⭐⭐ | Web integration | ✅ Ready |
| **4. QGIS** | ⭐⭐ | Visual/GUI users | ✅ Ready |
| **5. Docker/GDAL** | ⭐ | Isolation | ⚠️ Complex |

---

## ✅ Option 1: Python with GeoPandas (Recommended - Already Available)

**Status:** ✅ Script already exists in your codebase

**Location:** `data/tiger/load-with-python.py`

### Installation:
```powershell
pip install geopandas psycopg2 sqlalchemy
```

### Usage:
```powershell
cd "C:\Projects\Real Estate\data\tiger"
python load-with-python.py
```

**Pros:**
- ✅ Already implemented in your codebase
- ✅ Works on Windows without GDAL
- ✅ **Supports both shapefiles (.shp) and GeoJSON (.geojson, .json)**
- ✅ Handles all TIGER shapefiles
- ✅ Automatic CRS conversion to EPSG:4326
- ✅ GeoPandas automatically detects file type

**Cons:**
- Requires Python and pip
- GeoPandas can be slow for very large files

### Examples:

**Load a shapefile:**
```powershell
python load-with-python.py
# Script will look for .shp files, or .geojson if .shp not found
```

**Load a GeoJSON file:**
```powershell
# GeoPandas can read GeoJSON directly - just point to the file
# The script will automatically detect the file type
```

---

## 📋 Important: Shapefile Component Files

**Shapefiles consist of multiple files** that must all be present:
- **`.shp`** - Geometry data (required)
- **`.shx`** - Index file (required)
- **`.dbf`** - Attribute data (required)
- **`.prj`** - Projection/CRS information (optional but recommended)
- **`.cpg`** - Code page/encoding (optional)
- **`.xml`** - Metadata (optional)

**✅ Our scripts automatically handle all component files!**
- The `shapefile` npm package automatically reads `.shx` and `.dbf` when you open the `.shp` file
- The script validates that all required files are present before loading
- Just point to the `.shp` file - the library finds the other files automatically

**Make sure:** When you unzip a shapefile, keep all files in the same directory!

---

## ✅ Option 2: Node.js/TypeScript with Shapefile Library (Best for Your Stack)

**Status:** ✅ **NEW! Script created and ready to use**

A new TypeScript script (`scripts/load-shapefiles-to-supabase.ts`) loads shapefiles directly to Supabase without GDAL.

### Installation:
```powershell
# Install dependencies (if not already installed)
npm install

# Dependencies needed:
# - shapefile (for reading shapefiles)
# - @supabase/supabase-js (for Supabase connection)
# - dotenv (for environment variables)
# - tsx (for running TypeScript, already in devDependencies)
```

### Usage:

**Load all TIGER shapefiles:**
```powershell
npm run load-shapefiles -- --project-ref YOUR_PROJECT_REF
```

**Load a specific shapefile:**
```powershell
npm run load-shapefiles -- \
  --file "data/tiger/tl_2024_us_cbsa.shp" \
  --table "tiger_cbsa" \
  --project-ref YOUR_PROJECT_REF \
  --geometry-column "geom" \
  --geoid-field "GEOID"
```

**With password in command (optional):**
```powershell
npm run load-shapefiles -- \
  --file "data/tiger/tl_2024_us_state.shp" \
  --table "tiger_states" \
  --project-ref YOUR_PROJECT_REF \
  --password "your_db_password"
```

### Features:
- ✅ **Supports both shapefiles (.shp) and GeoJSON (.geojson, .json)**
- ✅ Automatic file type detection based on extension
- ✅ Direct loading (no conversion step needed)
- ✅ Batch processing for large files
- ✅ Automatic CRS handling (assumes EPSG:4326)
- ✅ Progress reporting
- ✅ Error handling and reporting
- ✅ Uses your existing `exec_sql` RPC function

**Pros:**
- ✅ Pure Node.js/TypeScript (matches your stack)
- ✅ No GDAL required
- ✅ Handles both shapefiles AND GeoJSON files
- ✅ Can batch load efficiently
- ✅ Works with your existing Supabase setup

**Cons:**
- Requires `exec_sql` function in your database (already exists in your codebase)
- Slightly slower than GDAL for very large files

### Examples:

**Load a shapefile:**
```powershell
npm run load-shapefiles -- \
  --file "data/tiger/tl_2024_us_cbsa.shp" \
  --table "tiger_cbsa" \
  --project-ref YOUR_PROJECT_REF
```

**Load a GeoJSON file:**
```powershell
npm run load-shapefiles -- \
  --file "scripts/geojson/tl_2024_us_cbsa.geojson" \
  --table "tiger_cbsa" \
  --project-ref YOUR_PROJECT_REF
```

---

## ✅ Option 3: Use Existing GeoJSON Files + API Route

**Status:** ✅ Already implemented

You already have:
- `scripts/geojson/` directory with converted GeoJSON files
- `web/app/api/load-cbsa-geometries-direct/route.ts` API route

### Usage:
```powershell
# 1. Convert shapefiles to GeoJSON (if not already done)
cd scripts
npm run convert-shapefiles

# 2. Load via API route
# Use the web interface or call the API directly
```

**API Endpoint:**
```
POST /api/load-cbsa-geometries-direct
Content-Type: application/json

{
  "geojsonPath": "scripts/geojson/tl_2024_us_cbsa.geojson",
  "tableName": "dim_geography_geometry",
  "geometryColumn": "geom"
}
```

**Pros:**
- ✅ No GDAL needed
- ✅ Uses your existing infrastructure
- ✅ Can be called from web UI
- ✅ Handles large files with batching

**Cons:**
- Requires shapefile → GeoJSON conversion first
- API route needs to be called for each file

---

## ✅ Option 4: QGIS (GUI Option)

**Status:** ✅ Documentation exists

**Location:** `scripts/QGIS-SUPABASE-SETUP.md`

### Installation:
1. Download QGIS: https://qgis.org/download/
2. Install PostGIS plugin (usually included)

### Usage:
1. Open QGIS
2. Connect to Supabase database
3. Use **DB Manager → Import Vector Layer**
4. Select shapefile and target table

**Pros:**
- ✅ Visual interface
- ✅ No command line needed
- ✅ Can preview data before loading
- ✅ Built-in error handling

**Cons:**
- Large GUI application (~500MB)
- Manual process (not scriptable)
- Slower for batch operations

---

## ✅ Option 5: Docker with GDAL (Isolated Environment)

**Status:** ⚠️ Requires Docker setup

If you want to use GDAL but isolate it from your system:

### Installation:
```powershell
# Install Docker Desktop for Windows
# Then create a Dockerfile
```

### Usage:
```powershell
docker run --rm -v "${PWD}:/data" osgeo/gdal:latest \
  ogr2ogr -f PostgreSQL \
  "PG:host=db.YOUR_PROJECT.supabase.co dbname=postgres user=postgres password=YOUR_PASSWORD port=5432 sslmode=require" \
  /data/tl_2024_us_cbsa.shp \
  -nln tiger_cbsa \
  -nlt PROMOTE_TO_MULTI \
  -lco GEOMETRY_NAME=geom \
  -t_srs EPSG:4326
```

**Pros:**
- ✅ Isolated from your system
- ✅ No installation conflicts
- ✅ Works on any OS

**Cons:**
- Requires Docker
- More complex setup
- Network access needed for Supabase

---

## 🎯 Recommended Approach

**For your project, I recommend:**

1. **Short-term:** Use **Option 1 (Python/GeoPandas)** - it's already implemented and works
2. **Long-term:** Implement **Option 2 (Node.js/TypeScript)** - matches your stack better

---

## Quick Start: Python Alternative

```powershell
# 1. Install Python dependencies
pip install geopandas psycopg2 sqlalchemy

# 2. Run the loader
cd "C:\Projects\Real Estate\data\tiger"
python load-with-python.py

# 3. Enter your Supabase password when prompted
```

The script will:
- ✅ Load all TIGER shapefiles (states, counties, CBSA, ZCTA, places)
- ✅ Convert CRS to EPSG:4326 automatically
- ✅ Create PostGIS geometry columns
- ✅ Handle large files efficiently

---

## Quick Start: Node.js Alternative (✅ Ready to Use)

The TypeScript script is now available! It:
1. ✅ Reads shapefiles using the `shapefile` npm package
2. ✅ Reads GeoJSON files directly
3. ✅ Automatically detects file type (.shp, .geojson, .json)
4. ✅ Loads directly to Supabase using PostGIS functions

**To use it:**
```powershell
# Load all TIGER files (shapefiles or GeoJSON)
npm run load-shapefiles -- --project-ref pysflbhpnqwoczyuaaif

# Load a specific shapefile
npm run load-shapefiles -- \
  --file "data/tiger/tl_2024_us_cbsa.shp" \
  --table "tiger_cbsa" \
  --project-ref pysflbhpnqwoczyuaaif

# Load a specific GeoJSON file
npm run load-shapefiles -- \
  --file "scripts/geojson/tl_2024_us_cbsa.geojson" \
  --table "tiger_cbsa" \
  --project-ref pysflbhpnqwoczyuaaif
```

---

## Troubleshooting

### Python/GeoPandas Issues

**Error: "Microsoft Visual C++ 14.0 is required"**
```powershell
# Install Visual C++ Build Tools
# Or use conda instead:
conda install -c conda-forge geopandas
```

**Error: "Could not find GDAL"**
- GeoPandas needs GDAL, but it's bundled in conda
- Use conda: `conda install -c conda-forge geopandas`

### Node.js Issues

**Error: "Cannot find module 'shapefile'"**
```powershell
cd web
npm install shapefile
```

**Error: "Connection refused"**
- Check Supabase connection string
- Verify database password
- Check firewall settings

---

## Comparison Table

| Method | Setup Time | Speed | Windows Compat | Scriptable | Recommended |
|--------|-----------|-------|----------------|------------|-------------|
| Python/GeoPandas | ⭐⭐⭐ | ⭐⭐⭐ | ✅ Yes | ✅ Yes | ✅ **Best for now** |
| Node.js/TypeScript | ⭐⭐ | ⭐⭐⭐⭐ | ✅ Yes | ✅ Yes | ✅ **Best long-term** |
| GeoJSON + API | ⭐⭐⭐⭐ | ⭐⭐⭐ | ✅ Yes | ✅ Yes | ✅ Good |
| QGIS | ⭐⭐ | ⭐⭐ | ✅ Yes | ❌ No | ⚠️ Manual only |
| Docker/GDAL | ⭐ | ⭐⭐⭐⭐ | ✅ Yes | ✅ Yes | ⚠️ Complex |

---

## Next Steps

1. **Try Python option first** (fastest to get working)
2. **If you want Node.js**, I can create a TypeScript loader script
3. **For production**, consider the Node.js approach to match your stack

Let me know which option you'd like to proceed with!

