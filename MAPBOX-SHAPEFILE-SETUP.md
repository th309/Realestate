# Mapbox Shapefile Setup Guide

## Overview
You need shapefiles for 4 geographic levels: States, Metros (MSAs), Cities, and Zip Codes. Here's how to get them.

## Option 1: Mapbox Studio (Recommended)

### Step 1: Create Mapbox Account
1. Go to https://www.mapbox.com/
2. Sign up for free account (includes 50,000 free map loads/month)
3. Get your access token from https://account.mapbox.com/

### Step 2: Use Mapbox Boundaries
Mapbox provides pre-made boundary tilesets:

1. **Go to Mapbox Studio**: https://studio.mapbox.com/
2. **Navigate to Tilesets**
3. **Look for Mapbox Boundaries** (premium feature, but has free tier)

Available boundaries:
- `mapbox.boundaries-adm1` - States/Provinces (Admin Level 1)
- `mapbox.boundaries-pos3` - Zip/Postal codes (Postal Level 3)
- `mapbox.boundaries-sta2` - Statistical areas (includes MSAs)
- `mapbox.boundaries-loc3` - Localities/Cities (Locality Level 3)

### Step 3: Access via API
```javascript
// Add to your .env.local
MAPBOX_ACCESS_TOKEN=your_token_here

// Fetch boundaries via Mapbox API
const boundaries = await fetch(
  `https://api.mapbox.com/v4/mapbox.boundaries-adm1.json?access_token=${MAPBOX_ACCESS_TOKEN}`
);
```

## Option 2: Free Public Sources (Recommended for Start)

### A. US Census Bureau TIGER/Line Shapefiles (Best Free Option)

**Download Link**: https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html

#### 1. States
- **File**: `tl_2023_us_state.zip`
- **URL**: https://www2.census.gov/geo/tiger/TIGER2023/STATE/
- Contains all 50 states + DC + territories

#### 2. Metropolitan Statistical Areas (MSAs)
- **File**: `tl_2023_us_cbsa.zip`
- **URL**: https://www2.census.gov/geo/tiger/TIGER2023/CBSA/
- Contains all Core Based Statistical Areas (includes MSAs)

#### 3. Cities (Places)
- **File**: `tl_2023_[STATE_FIPS]_place.zip` (one per state)
- **URL**: https://www2.census.gov/geo/tiger/TIGER2023/PLACE/
- Example for New York: `tl_2023_36_place.zip`

#### 4. ZIP Code Tabulation Areas (ZCTAs)
- **File**: `tl_2023_us_zcta520.zip`
- **URL**: https://www2.census.gov/geo/tiger/TIGER2023/ZCTA520/
- Contains all ZIP code areas

### B. Natural Earth (Simple, Clean Boundaries)
**URL**: https://www.naturalearthdata.com/

Good for states, less detailed for cities/zips:
- States: `ne_10m_admin_1_states_provinces.zip`
- Clean, simplified geometries
- Good for web mapping

### C. OpenStreetMap via Geofabrik
**URL**: https://download.geofabrik.de/

- Can extract boundaries from OSM data
- More complex but very detailed

## Option 3: Convert Census to Mapbox Format

### Step 1: Download Census Shapefiles
```bash
# Create directory for shapefiles
mkdir -p shapefiles
cd shapefiles

# Download states
wget https://www2.census.gov/geo/tiger/TIGER2023/STATE/tl_2023_us_state.zip
unzip tl_2023_us_state.zip

# Download MSAs
wget https://www2.census.gov/geo/tiger/TIGER2023/CBSA/tl_2023_us_cbsa.zip
unzip tl_2023_us_cbsa.zip

# Download ZCTAs (ZIP codes)
wget https://www2.census.gov/geo/tiger/TIGER2023/ZCTA520/tl_2023_us_zcta520.zip
unzip tl_2023_us_zcta520.zip

# Download places for specific states (example: NY, CA, TX)
wget https://www2.census.gov/geo/tiger/TIGER2023/PLACE/tl_2023_36_place.zip
wget https://www2.census.gov/geo/tiger/TIGER2023/PLACE/tl_2023_06_place.zip
wget https://www2.census.gov/geo/tiger/TIGER2023/PLACE/tl_2023_48_place.zip
```

### Step 2: Convert to GeoJSON
```bash
# Install GDAL tools
# Mac: brew install gdal
# Ubuntu: sudo apt-get install gdal-bin
# Windows: Use OSGeo4W installer

# Convert shapefiles to GeoJSON
ogr2ogr -f GeoJSON states.geojson tl_2023_us_state.shp
ogr2ogr -f GeoJSON metros.geojson tl_2023_us_cbsa.shp
ogr2ogr -f GeoJSON zipcodes.geojson tl_2023_us_zcta520.shp
ogr2ogr -f GeoJSON cities_ny.geojson tl_2023_36_place.shp
```

### Step 3: Simplify for Web (Important!)
```bash
# Install mapshaper
npm install -g mapshaper

# Simplify geometries (keeps 10% of points, preserves topology)
mapshaper states.geojson -simplify 10% -o states_simplified.geojson
mapshaper metros.geojson -simplify 10% -o metros_simplified.geojson
mapshaper zipcodes.geojson -simplify 5% -o zipcodes_simplified.geojson
mapshaper cities_ny.geojson -simplify 10% -o cities_ny_simplified.geojson
```

### Step 4: Upload to Mapbox Studio
1. Go to https://studio.mapbox.com/tilesets/
2. Click "New tileset" → "Upload"
3. Upload each GeoJSON file
4. Mapbox will create vector tiles automatically

## Option 4: Use Pre-processed Datasets

### A. GeoJSON.xyz (Quick & Free)
```javascript
// Direct URLs for US boundaries
const sources = {
  states: 'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_admin_1_states_provinces.geojson',
  counties: 'https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json',
  // Note: MSAs and detailed cities not available here
};
```

### B. Who's On First (Comprehensive)
**URL**: https://whosonfirst.org/

- Comprehensive gazetteer with all geographic levels
- REST API available
- Large dataset but very complete

## Loading Shapefiles into PostgreSQL

### Using PostGIS
```sql
-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Load shapefile using shp2pgsql (comes with PostGIS)
```

```bash
# Convert and load in one command
shp2pgsql -I -s 4326 tl_2023_us_state.shp public.temp_states | psql -d your_database

# Or create SQL file first
shp2pgsql -I -s 4326 tl_2023_us_state.shp public.temp_states > states.sql
psql -d your_database -f states.sql
```

### Process in Database
```sql
-- Import states from temporary table
INSERT INTO markets (
    region_id,
    region_name,
    region_type,
    state_code,
    state_name,
    census_id,
    geometry,
    simplified_geometry,
    centroid_lat,
    centroid_lon,
    bounds
)
SELECT 
    'state_' || LOWER(STUSPS) as region_id,
    NAME as region_name,
    'state' as region_type,
    STUSPS as state_code,
    NAME as state_name,
    STATEFP as census_id,
    geometry,
    ST_SimplifyPreserveTopology(geometry, 0.01) as simplified_geometry,
    ST_Y(ST_Centroid(geometry)) as centroid_lat,
    ST_X(ST_Centroid(geometry)) as centroid_lon,
    json_build_object(
        'north', ST_YMax(geometry),
        'south', ST_YMin(geometry),
        'east', ST_XMax(geometry),
        'west', ST_XMin(geometry)
    ) as bounds
FROM temp_states
WHERE STATEFP <= '56'; -- Exclude territories if desired

-- Import MSAs
INSERT INTO markets (
    region_id,
    region_name,
    region_type,
    state_code,
    metro_id,
    metro_name,
    census_id,
    geometry,
    simplified_geometry,
    centroid_lat,
    centroid_lon,
    bounds
)
SELECT 
    'metro_' || CBSAFP as region_id,
    NAME as region_name,
    'metro' as region_type,
    -- State code would need to be derived from geometry intersection
    NULL as state_code,
    'metro_' || CBSAFP as metro_id,
    NAME as metro_name,
    CBSAFP as census_id,
    geometry,
    ST_SimplifyPreserveTopology(geometry, 0.005) as simplified_geometry,
    ST_Y(ST_Centroid(geometry)) as centroid_lat,
    ST_X(ST_Centroid(geometry)) as centroid_lon,
    json_build_object(
        'north', ST_YMax(geometry),
        'south', ST_YMin(geometry),
        'east', ST_XMax(geometry),
        'west', ST_XMin(geometry)
    ) as bounds
FROM temp_cbsa
WHERE LSAD = 'M1'; -- Metropolitan Statistical Areas only
```

## Option 5: Use Node.js Libraries

### Install Dependencies
```bash
npm install @turf/turf shapefile geojson-vt
```

### Load and Process
```javascript
import shapefile from 'shapefile';
import * as turf from '@turf/turf';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

async function loadShapefileToDatabase(shapefilePath, regionType) {
    const supabase = createSupabaseAdminClient();
    
    // Read shapefile
    const source = await shapefile.open(shapefilePath);
    const features = [];
    
    while (true) {
        const result = await source.read();
        if (result.done) break;
        features.push(result.value);
    }
    
    // Process each feature
    for (const feature of features) {
        const simplified = turf.simplify(feature, {
            tolerance: 0.01,
            highQuality: true
        });
        
        const centroid = turf.centroid(feature);
        const bbox = turf.bbox(feature);
        
        const marketData = {
            region_id: generateRegionId(feature, regionType),
            region_name: feature.properties.NAME,
            region_type: regionType,
            state_code: feature.properties.STUSPS,
            census_id: feature.properties.GEOID,
            geometry: feature.geometry,
            simplified_geometry: simplified.geometry,
            centroid_lat: centroid.geometry.coordinates[1],
            centroid_lon: centroid.geometry.coordinates[0],
            bounds: {
                north: bbox[3],
                south: bbox[1],
                east: bbox[2],
                west: bbox[0]
            }
        };
        
        await supabase
            .from('markets')
            .upsert(marketData);
    }
}

// Usage
await loadShapefileToDatabase('./shapefiles/tl_2023_us_state.shp', 'state');
await loadShapefileToDatabase('./shapefiles/tl_2023_us_cbsa.shp', 'metro');
```

## Quick Start Recommendation

For fastest setup:

1. **Download Census TIGER shapefiles** (Option 2A)
   - Free, official, comprehensive
   - Has all 4 levels you need

2. **Convert to GeoJSON** using ogr2ogr

3. **Simplify with mapshaper** for web performance

4. **Load into PostgreSQL** using PostGIS

5. **Create Mapbox account** and upload simplified GeoJSON for visualization

## File Size Considerations

| Geography | Original Size | Simplified (10%) | Simplified (5%) |
|-----------|--------------|------------------|-----------------|
| States | ~10 MB | ~1 MB | ~0.5 MB |
| MSAs | ~15 MB | ~1.5 MB | ~0.75 MB |
| Cities (all) | ~100 MB | ~10 MB | ~5 MB |
| ZCTAs | ~500 MB | ~50 MB | ~25 MB |

**Tip**: For web mapping, aim for < 5MB per layer

## Next Steps

1. **Choose your source** (Census TIGER recommended)
2. **Download the 4 shapefiles** you need
3. **Process and simplify** for web use
4. **Load into your database** with PostGIS
5. **Create region mappings** for your data sources
6. **Upload to Mapbox** for visualization

## Additional Resources

- [Census TIGER Documentation](https://www.census.gov/programs-surveys/geography/technical-documentation/complete-technical-documentation/tiger-geo-line.html)
- [Mapbox Upload API](https://docs.mapbox.com/api/maps/uploads/)
- [PostGIS Documentation](https://postgis.net/documentation/)
- [Mapshaper Documentation](https://github.com/mbloch/mapshaper/wiki)
- [GDAL/OGR Documentation](https://gdal.org/programs/ogr2ogr.html)
