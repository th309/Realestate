#!/usr/bin/env node
/**
 * Convert Census Place (City) and Tract shapefiles to GeoJSON
 * Outputs per-state files to match the ZCTA pattern
 */

import * as fs from 'fs';
import * as path from 'path';
import { open } from 'shapefile';

const SHAPEFILE_DIR = path.join(__dirname, 'shapefiles');
const GEOJSON_DIR = path.join(__dirname, '..', 'packages', 'frontend', 'public', 'geojson');

// FIPS to state abbreviation mapping
const FIPS_TO_STATE: Record<string, string> = {
  '01': 'al', '02': 'ak', '04': 'az', '05': 'ar', '06': 'ca',
  '08': 'co', '09': 'ct', '10': 'de', '11': 'dc', '12': 'fl',
  '13': 'ga', '15': 'hi', '16': 'id', '17': 'il', '18': 'in',
  '19': 'ia', '20': 'ks', '21': 'ky', '22': 'la', '23': 'me',
  '24': 'md', '25': 'ma', '26': 'mi', '27': 'mn', '28': 'ms',
  '29': 'mo', '30': 'mt', '31': 'ne', '32': 'nv', '33': 'nh',
  '34': 'nj', '35': 'nm', '36': 'ny', '37': 'nc', '38': 'nd',
  '39': 'oh', '40': 'ok', '41': 'or', '42': 'pa', '44': 'ri',
  '45': 'sc', '46': 'sd', '47': 'tn', '48': 'tx', '49': 'ut',
  '50': 'vt', '51': 'va', '53': 'wa', '54': 'wv', '55': 'wi',
  '56': 'wy', '60': 'as', '66': 'gu', '69': 'mp', '72': 'pr', '78': 'vi',
};

interface ConversionResult {
  input: string;
  output: string;
  featureCount: number;
  success: boolean;
  error?: string;
}

async function convertShapefileToGeoJSON(
  shpPath: string,
  outputPath: string
): Promise<ConversionResult> {
  const fileName = path.basename(shpPath, '.shp');

  try {
    console.log(`  Converting: ${fileName}...`);

    const source = await open(shpPath);
    const features: any[] = [];

    while (true) {
      const result = await source.read();
      if (result.done) break;
      features.push(result.value);
    }

    // Create GeoJSON FeatureCollection
    const geojson = {
      type: 'FeatureCollection',
      features: features,
    };

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write to file (compact for smaller file sizes)
    fs.writeFileSync(outputPath, JSON.stringify(geojson));

    const sizeMB = (fs.statSync(outputPath).size / (1024 * 1024)).toFixed(2);
    console.log(`    ✓ ${features.length} features (${sizeMB} MB)`);

    return {
      input: fileName,
      output: path.basename(outputPath),
      featureCount: features.length,
      success: true,
    };
  } catch (error: any) {
    console.error(`    ✗ Failed: ${error.message}`);
    return {
      input: fileName,
      output: path.basename(outputPath),
      featureCount: 0,
      success: false,
      error: error.message,
    };
  }
}

async function main() {
  console.log('========================================');
  console.log('Place & Tract to GeoJSON Converter');
  console.log('========================================\n');

  // Create output directories
  const placeDir = path.join(GEOJSON_DIR, 'place');
  const tractDir = path.join(GEOJSON_DIR, 'tract');

  if (!fs.existsSync(placeDir)) fs.mkdirSync(placeDir, { recursive: true });
  if (!fs.existsSync(tractDir)) fs.mkdirSync(tractDir, { recursive: true });

  const results: ConversionResult[] = [];
  const startTime = Date.now();

  // Find all shapefiles
  const files = fs.readdirSync(SHAPEFILE_DIR);

  // Convert Place (City) shapefiles
  console.log('Converting Place (City) shapefiles...\n');
  const placeFiles = files.filter(f => f.match(/^tl_2024_\d{2}_place\.shp$/));

  for (const file of placeFiles) {
    const fips = file.match(/tl_2024_(\d{2})_place\.shp/)?.[1];
    if (!fips || !FIPS_TO_STATE[fips]) continue;

    const stateAbbrev = FIPS_TO_STATE[fips];
    const shpPath = path.join(SHAPEFILE_DIR, file);
    const outputPath = path.join(placeDir, `${stateAbbrev}.json`);

    // Skip if already exists
    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`  Skipping ${stateAbbrev} places (already exists, ${sizeMB} MB)`);
      continue;
    }

    const result = await convertShapefileToGeoJSON(shpPath, outputPath);
    results.push(result);
  }

  // Convert Tract shapefiles
  console.log('\nConverting Tract shapefiles...\n');
  const tractFiles = files.filter(f => f.match(/^tl_2024_\d{2}_tract\.shp$/));

  for (const file of tractFiles) {
    const fips = file.match(/tl_2024_(\d{2})_tract\.shp/)?.[1];
    if (!fips || !FIPS_TO_STATE[fips]) continue;

    const stateAbbrev = FIPS_TO_STATE[fips];
    const shpPath = path.join(SHAPEFILE_DIR, file);
    const outputPath = path.join(tractDir, `${stateAbbrev}.json`);

    // Skip if already exists
    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`  Skipping ${stateAbbrev} tracts (already exists, ${sizeMB} MB)`);
      continue;
    }

    const result = await convertShapefileToGeoJSON(shpPath, outputPath);
    results.push(result);
  }

  // Summary
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000 / 60).toFixed(2);

  console.log('\n========================================');
  console.log('Conversion Complete!');
  console.log('========================================\n');

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const totalFeatures = results.reduce((sum, r) => sum + r.featureCount, 0);

  console.log(`Summary:`);
  console.log(`  Successful: ${successful.length}`);
  console.log(`  Failed: ${failed.length}`);
  console.log(`  Total features: ${totalFeatures.toLocaleString()}`);
  console.log(`  Total time: ${duration} minutes\n`);

  // List output directories
  console.log(`Output directories:`);
  console.log(`  Places: ${placeDir}`);
  console.log(`  Tracts: ${tractDir}`);

  // Show file counts and sizes
  const placeFiles2 = fs.readdirSync(placeDir).filter(f => f.endsWith('.json'));
  const tractFiles2 = fs.readdirSync(tractDir).filter(f => f.endsWith('.json'));

  let placeTotalSize = 0;
  let tractTotalSize = 0;

  for (const f of placeFiles2) {
    placeTotalSize += fs.statSync(path.join(placeDir, f)).size;
  }
  for (const f of tractFiles2) {
    tractTotalSize += fs.statSync(path.join(tractDir, f)).size;
  }

  console.log(`\n  Place files: ${placeFiles2.length} (${(placeTotalSize / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`  Tract files: ${tractFiles2.length} (${(tractTotalSize / 1024 / 1024).toFixed(2)} MB)`);

  if (failed.length > 0) {
    console.log('\nFailed conversions:');
    for (const result of failed) {
      console.log(`  ${result.input}: ${result.error}`);
    }
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
