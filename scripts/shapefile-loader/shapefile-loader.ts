/**
 * Shapefile Loader
 */

import * as fs from 'fs';
import * as path from 'path';
import { open } from 'shapefile';
import type { LoadOptions, LoadResult } from './types';
import { DEFAULT_PROJECT_REF, DEFAULT_BATCH_SIZE, ZCTA_BATCH_SIZE } from './types';
import { getSupabaseClient, resolvePassword } from './db-client';
import { loadBatch } from './batch-loader';

/**
 * Load a shapefile to Supabase
 */
export async function loadShapefile(
  shapefilePath: string,
  tableName: string,
  options: LoadOptions
): Promise<LoadResult> {
  const {
    projectRef = DEFAULT_PROJECT_REF,
    dbPassword,
    geometryColumn = 'geom',
    geoidField = 'GEOID',
    batchSize = tableName === 'tiger_zcta' ? ZCTA_BATCH_SIZE : DEFAULT_BATCH_SIZE
  } = options;

  if (!fs.existsSync(shapefilePath)) {
    throw new Error(`Shapefile not found: ${shapefilePath}`);
  }

  verifyShapefileComponents(shapefilePath);

  const password = await resolvePassword(dbPassword);
  const supabase = getSupabaseClient(projectRef, password);

  const optionalFilesInfo = getOptionalFilesInfo(shapefilePath);

  console.log(`\nLoading Shapefile: ${path.basename(shapefilePath)}`);
  console.log(`   Table: ${tableName}`);
  console.log(`   Geometry column: ${geometryColumn}`);
  console.log(`   Batch size: ${batchSize}`);
  if (optionalFilesInfo.length > 0) {
    console.log(`   Optional files found: ${optionalFilesInfo.join(', ')}`);
  }
  console.log();

  const source = await open(shapefilePath);

  let loaded = 0;
  let errors = 0;
  const errorMessages: string[] = [];
  let batch: any[] = [];
  let featureCount = 0;

  try {
    while (true) {
      const result = await source.read();

      if (result.done) {
        if (batch.length > 0) {
          const batchResult = await loadBatch(batch, tableName, geometryColumn, geoidField, supabase);
          loaded += batchResult.loaded;
          errors += batchResult.errors;
          errorMessages.push(...batchResult.errorMessages);
        }
        break;
      }

      batch.push(result.value);
      featureCount++;

      if (batch.length >= batchSize) {
        const batchResult = await loadBatch(batch, tableName, geometryColumn, geoidField, supabase);
        loaded += batchResult.loaded;
        errors += batchResult.errors;
        errorMessages.push(...batchResult.errorMessages);

        batch = [];

        if (featureCount % 100 === 0) {
          process.stdout.write(`\r   Processed ${featureCount} features... (Loaded: ${loaded}, Errors: ${errors})`);
        }
      }
    }

    console.log(`\n\nComplete!`);
    console.log(`   Total features: ${featureCount}`);
    console.log(`   Loaded: ${loaded}`);
    console.log(`   Errors: ${errors}`);

  } finally {
    if (source.close) {
      await source.close();
    }
  }

  return {
    success: errors === 0,
    loaded,
    errors,
    errorMessages: errorMessages.slice(0, 10)
  };
}

/**
 * Verify required shapefile component files exist
 */
function verifyShapefileComponents(shapefilePath: string): void {
  const basePath = shapefilePath.replace(/\.shp$/i, '');
  const requiredFiles = {
    shp: `${basePath}.shp`,
    shx: `${basePath}.shx`,
    dbf: `${basePath}.dbf`
  };

  const missingFiles: string[] = [];
  for (const [type, filePath] of Object.entries(requiredFiles)) {
    if (!fs.existsSync(filePath)) {
      missingFiles.push(`${type.toUpperCase()} (${path.basename(filePath)})`);
    }
  }

  if (missingFiles.length > 0) {
    throw new Error(
      `Missing required shapefile component files:\n` +
      `  ${missingFiles.join('\n  ')}\n\n` +
      `Shapefiles require multiple files (.shp, .shx, .dbf) in the same directory.\n` +
      `Make sure all files from the unzipped shapefile are present.`
    );
  }
}

/**
 * Get info about optional files that are present
 */
function getOptionalFilesInfo(shapefilePath: string): string[] {
  const basePath = shapefilePath.replace(/\.shp$/i, '');
  const optionalFiles = {
    prj: `${basePath}.prj`,
    cpg: `${basePath}.cpg`
  };

  const presentOptional: string[] = [];
  for (const [type, filePath] of Object.entries(optionalFiles)) {
    if (fs.existsSync(filePath)) {
      presentOptional.push(type.toUpperCase());
    }
  }

  return presentOptional;
}
