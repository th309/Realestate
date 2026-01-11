#!/usr/bin/env node
/**
 * Load TIGER shapefiles and GeoJSON files directly to Supabase PostGIS
 * No GDAL required - uses Node.js shapefile library for .shp files
 * Supports both .shp (shapefiles) and .geojson/.json files
 *
 * Usage:
 *   npm run load-shapefiles -- --project-ref YOUR_PROJECT_REF
 *   npm run load-shapefiles -- --file path/to/file.shp --table table_name
 *   npm run load-shapefiles -- --file path/to/file.geojson --table table_name
 *
 * Refactored to use modular components from ./shapefile-loader/
 */

import type { LoadOptions, LoadResult } from './shapefile-loader/types';
import { loadShapefile } from './shapefile-loader/shapefile-loader';
import { loadGeoJSON } from './shapefile-loader/geojson-loader';
import { loadGeographicFile } from './shapefile-loader/loader';
import { main } from './shapefile-loader/cli';

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { loadShapefile, loadGeoJSON, loadGeographicFile, LoadOptions, LoadResult };
