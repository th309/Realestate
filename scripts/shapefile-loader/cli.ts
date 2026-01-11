/**
 * CLI Handler for Shapefile Loader
 */

import * as fs from 'fs';
import * as path from 'path';
import type { LoadOptions } from './types';
import { loadEnvironment } from './env-loader';
import { loadGeographicFile } from './loader';

/**
 * Parse command line arguments
 */
export function parseArgs(args: string[]): LoadOptions {
  const options: LoadOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if (arg === '--project-ref' && nextArg) {
      options.projectRef = nextArg;
      i++;
    } else if (arg === '--file' && nextArg) {
      options.shapefilePath = nextArg;
      i++;
    } else if (arg === '--table' && nextArg) {
      options.tableName = nextArg;
      i++;
    } else if (arg === '--geometry-column' && nextArg) {
      options.geometryColumn = nextArg;
      i++;
    } else if (arg === '--geoid-field' && nextArg) {
      options.geoidField = nextArg;
      i++;
    } else if (arg === '--batch-size' && nextArg) {
      options.batchSize = parseInt(nextArg, 10);
      i++;
    } else if (arg === '--password' && nextArg) {
      options.dbPassword = nextArg;
      i++;
    }
  }

  return options;
}

/**
 * Default TIGER files configuration
 */
export const TIGER_FILES = [
  { file: 'tl_2024_us_state.shp', table: 'tiger_states', geoid: 'GEOID' },
  { file: 'tl_2024_us_county.shp', table: 'tiger_counties', geoid: 'GEOID' },
  { file: 'tl_2024_us_cbsa.shp', table: 'tiger_cbsa', geoid: 'GEOID' },
  { file: 'tl_2024_us_zcta520.shp', table: 'tiger_zcta', geoid: 'GEOID20' },
];

/**
 * Load all TIGER files from directory
 */
export async function loadAllTigerFiles(
  tigerDir: string,
  options: LoadOptions
): Promise<{ totalLoaded: number; totalErrors: number }> {
  let totalLoaded = 0;
  let totalErrors = 0;

  for (const { file, table, geoid } of TIGER_FILES) {
    const filePath = path.join(tigerDir, file);

    if (!fs.existsSync(filePath)) {
      console.warn(`Warning: Skipping ${file} (not found)`);
      continue;
    }

    const result = await loadGeographicFile(filePath, table, {
      ...options,
      geoidField: geoid
    });

    totalLoaded += result.loaded;
    totalErrors += result.errors;
  }

  return { totalLoaded, totalErrors };
}

/**
 * Load all place files from directory
 */
export async function loadPlaceFiles(
  tigerDir: string,
  options: LoadOptions
): Promise<{ totalLoaded: number; totalErrors: number }> {
  console.log('\nLoading Places (this may take a while)...\n');

  const placeFiles = fs.readdirSync(tigerDir)
    .filter(f => f.startsWith('tl_2024_') && f.endsWith('_place.shp'))
    .map(f => path.join(tigerDir, f));

  if (placeFiles.length === 0) {
    return { totalLoaded: 0, totalErrors: 0 };
  }

  console.log(`   Found ${placeFiles.length} place files\n`);

  let totalLoaded = 0;
  let totalErrors = 0;

  for (let i = 0; i < placeFiles.length; i++) {
    if (i > 0) {
      console.log(`   Loading ${path.basename(placeFiles[i])}...`);
    }

    const result = await loadGeographicFile(placeFiles[i], 'tiger_places', {
      ...options,
      geoidField: 'GEOID'
    });

    totalLoaded += result.loaded;
    totalErrors += result.errors;
  }

  return { totalLoaded, totalErrors };
}

/**
 * Main CLI entry point
 */
export async function main(): Promise<void> {
  loadEnvironment();

  const args = process.argv.slice(2);
  const options = parseArgs(args);

  console.log('========================================');
  console.log('  Load Shapefiles to Supabase');
  console.log('  (No GDAL Required)');
  console.log('========================================\n');

  // If specific file provided, load it
  if (options.shapefilePath && options.tableName) {
    const result = await loadGeographicFile(
      options.shapefilePath,
      options.tableName,
      options
    );

    process.exit(result.success ? 0 : 1);
    return;
  }

  // Otherwise, load all TIGER files
  const scriptDir = __dirname;
  const tigerDir = path.join(scriptDir, '..', '..', 'data', 'tiger');

  if (!fs.existsSync(tigerDir)) {
    console.error(`TIGER directory not found: ${tigerDir}`);
    process.exit(1);
  }

  console.log('Loading all TIGER shapefiles...\n');

  const tigerResults = await loadAllTigerFiles(tigerDir, options);
  const placeResults = await loadPlaceFiles(tigerDir, options);

  const totalLoaded = tigerResults.totalLoaded + placeResults.totalLoaded;
  const totalErrors = tigerResults.totalErrors + placeResults.totalErrors;

  console.log('\n========================================');
  console.log('  Summary');
  console.log('========================================');
  console.log(`Total loaded: ${totalLoaded}`);
  console.log(`Total errors: ${totalErrors}`);
  console.log('');

  process.exit(totalErrors === 0 ? 0 : 1);
}
