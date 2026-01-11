/**
 * Main Geographic File Loader
 */

import * as path from 'path';
import type { LoadOptions, LoadResult } from './types';
import { loadGeoJSON } from './geojson-loader';
import { loadShapefile } from './shapefile-loader';

/**
 * Load a geographic file (shapefile or GeoJSON) to Supabase
 * Automatically detects file type based on extension
 */
export async function loadGeographicFile(
  filePath: string,
  tableName: string,
  options: LoadOptions
): Promise<LoadResult> {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.geojson' || ext === '.json') {
    return loadGeoJSON(filePath, tableName, options);
  } else if (ext === '.shp') {
    return loadShapefile(filePath, tableName, options);
  } else {
    throw new Error(`Unsupported file type: ${ext}. Supported: .shp, .geojson, .json`);
  }
}
