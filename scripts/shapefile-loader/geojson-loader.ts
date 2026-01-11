/**
 * GeoJSON File Loader
 */

import * as fs from 'fs';
import * as path from 'path';
import type { LoadOptions, LoadResult } from './types';
import { DEFAULT_PROJECT_REF, DEFAULT_BATCH_SIZE } from './types';
import { getSupabaseClient, resolvePassword } from './db-client';
import { loadBatch } from './batch-loader';

/**
 * Load a GeoJSON file to Supabase
 */
export async function loadGeoJSON(
  geojsonPath: string,
  tableName: string,
  options: LoadOptions
): Promise<LoadResult> {
  const {
    projectRef = DEFAULT_PROJECT_REF,
    dbPassword,
    geometryColumn = 'geom',
    geoidField = 'GEOID',
    batchSize = DEFAULT_BATCH_SIZE
  } = options;

  if (!fs.existsSync(geojsonPath)) {
    throw new Error(`GeoJSON file not found: ${geojsonPath}`);
  }

  const password = await resolvePassword(dbPassword);
  const supabase = getSupabaseClient(projectRef, password);

  console.log(`\nLoading GeoJSON: ${path.basename(geojsonPath)}`);
  console.log(`   Table: ${tableName}`);
  console.log(`   Geometry column: ${geometryColumn}`);
  console.log(`   Batch size: ${batchSize}\n`);

  const fileContent = fs.readFileSync(geojsonPath, 'utf-8');
  const geojson = JSON.parse(fileContent);

  if (geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
    throw new Error('Invalid GeoJSON format. Expected FeatureCollection with features array.');
  }

  const features = geojson.features;
  console.log(`   Found ${features.length} features\n`);

  let loaded = 0;
  let errors = 0;
  const errorMessages: string[] = [];

  for (let i = 0; i < features.length; i += batchSize) {
    const batch = features.slice(i, i + batchSize);

    const batchResult = await loadBatch(
      batch,
      tableName,
      geometryColumn,
      geoidField,
      supabase
    );

    loaded += batchResult.loaded;
    errors += batchResult.errors;
    errorMessages.push(...batchResult.errorMessages);

    if ((i + batchSize) % 100 === 0 || i + batchSize >= features.length) {
      process.stdout.write(
        `\r   Processed ${Math.min(i + batchSize, features.length)}/${features.length}... ` +
        `(Loaded: ${loaded}, Errors: ${errors})`
      );
    }
  }

  console.log(`\n\nComplete!`);
  console.log(`   Total features: ${features.length}`);
  console.log(`   Loaded: ${loaded}`);
  console.log(`   Errors: ${errors}`);

  return {
    success: errors === 0,
    loaded,
    errors,
    errorMessages: errorMessages.slice(0, 10)
  };
}
