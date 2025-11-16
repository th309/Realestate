# Shapefile Component Files - Complete Guide

## ✅ Yes, Our System Handles All Shapefile Components!

When you unzip a shapefile, you get multiple files. **Our scripts automatically handle all of them!**

---

## Shapefile Component Files

### Required Files (Must Be Present)

1. **`.shp`** - Main geometry file
   - Contains the actual geometric data (points, lines, polygons)
   - This is the file you point to in the script

2. **`.shx`** - Index file
   - Provides fast access to geometries in the .shp file
   - Required for efficient reading

3. **`.dbf`** - Attribute data file
   - Contains all the attribute/column data (GEOID, NAME, etc.)
   - Required to get properties like names, codes, etc.

### Optional Files (Nice to Have)

4. **`.prj`** - Projection file
   - Defines the coordinate reference system (CRS)
   - Our scripts assume EPSG:4326 (WGS84) if missing
   - Recommended to include for accuracy

5. **`.cpg`** - Code page file
   - Specifies character encoding (UTF-8, etc.)
   - Helps with proper text encoding

6. **`.xml`** - Metadata file
   - Contains metadata about the shapefile
   - Not used by our scripts but good for documentation

---

## How Our Scripts Handle Component Files

### ✅ TypeScript/Node.js Script (`load-shapefiles-to-supabase.ts`)

**Automatic Handling:**
- The `shapefile` npm package automatically reads `.shx` and `.dbf` when you open the `.shp` file
- You only need to specify the `.shp` file path
- The library finds the other files in the same directory

**Validation Added:**
- ✅ Checks that `.shp`, `.shx`, and `.dbf` files all exist
- ✅ Shows clear error if any required files are missing
- ✅ Reports which optional files (`.prj`, `.cpg`) are present

**Example:**
```powershell
# Just point to the .shp file - the script handles the rest!
npm run load-shapefiles -- \
  --file "data/tiger/tl_2024_us_cbsa.shp" \
  --table "tiger_cbsa" \
  --project-ref YOUR_PROJECT_REF
```

### ✅ Python Script (`load-with-python.py`)

**Automatic Handling:**
- GeoPandas automatically reads all component files when you use `gpd.read_file()`
- Just point to the `.shp` file and GeoPandas finds the others

**Validation Added:**
- ✅ Warns if `.shx` or `.dbf` files are missing
- ✅ Still attempts to load (GeoPandas may handle some cases)

**Example:**
```powershell
# Just point to the .shp file - GeoPandas handles the rest!
python load-with-python.py
```

---

## What You Need to Do

### ✅ When Unzipping Shapefiles:

1. **Extract ALL files** from the zip to the same directory
2. **Keep all files together** - don't move or delete any files
3. **Point to the `.shp` file** in your script - it will find the others

### ✅ File Structure Example:

```
data/tiger/
├── tl_2024_us_cbsa.shp    ← Point to this file
├── tl_2024_us_cbsa.shx    ← Automatically found
├── tl_2024_us_cbsa.dbf    ← Automatically found
├── tl_2024_us_cbsa.prj    ← Automatically found (optional)
├── tl_2024_us_cbsa.cpg    ← Automatically found (optional)
└── tl_2024_us_cbsa.shp.iso.xml  ← Ignored (metadata)
```

---

## Error Messages

### If Required Files Are Missing:

**TypeScript Script:**
```
Missing required shapefile component files:
  SHX (tl_2024_us_cbsa.shx)
  DBF (tl_2024_us_cbsa.dbf)

Shapefiles require multiple files (.shp, .shx, .dbf) in the same directory.
Make sure all files from the unzipped shapefile are present.
```

**Python Script:**
```
⚠ Warning: Missing shapefile component files: SHX, DBF
   Shapefiles require .shp, .shx, and .dbf files in the same directory.
```

---

## Technical Details

### How the Libraries Work:

1. **`shapefile` npm package:**
   - When you call `open('file.shp')`, it automatically looks for `file.shx` and `file.dbf` in the same directory
   - Reads geometry from `.shp`, attributes from `.dbf`, uses `.shx` for indexing
   - If `.prj` exists, it can read projection info (though we convert to EPSG:4326 anyway)

2. **GeoPandas:**
   - `gpd.read_file('file.shp')` automatically finds and reads all component files
   - Handles CRS conversion if `.prj` is present
   - More robust with missing optional files

---

## Summary

✅ **Yes, our system handles all shapefile components!**

- ✅ Required files (`.shp`, `.shx`, `.dbf`) are automatically read
- ✅ Optional files (`.prj`, `.cpg`) are detected and used if present
- ✅ Validation ensures all required files exist before loading
- ✅ Clear error messages if files are missing

**Just make sure:** When you unzip a shapefile, keep all files in the same directory and point to the `.shp` file. The scripts handle the rest!

