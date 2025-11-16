#!/usr/bin/env node
/**
 * Convert all TIGER shapefiles to GeoJSON
 * Processes: National, State, Metro, City, ZIP Code files
 */

import * as fs from 'fs';
import * as path from 'path';
import { open } from 'shapefile';

const SHAPEFILE_DIR = path.join(__dirname, 'shapefiles');
const GEOJSON_DIR = path.join(__dirname, 'geojson');

// Create geojson directory if it doesn't exist
if (!fs.existsSync(GEOJSON_DIR)) {
  fs.mkdirSync(GEOJSON_DIR, { recursive: true });
}

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
    console.log(`Converting: ${fileName}...`);
    
    // Force streaming for known large files (county, zipcode, cbsa)
    const forceStreaming = fileName.includes('county') || 
                          fileName.includes('zcta') || 
                          fileName.includes('cbsa');
    
    // For large files, use streaming approach
    // For smaller files, use in-memory approach
    let featureCount = 0;
    let useStreaming = forceStreaming;
    
    if (!useStreaming) {
      // First pass: count features to decide on approach (only for smaller files)
      const tempSource = await open(shpPath);
      try {
        while (true) {
          const result = await tempSource.read();
          if (result.done) break;
          featureCount++;
          if (featureCount > 10000) {
            useStreaming = true;
            break;
          }
        }
      } finally {
        // Ensure source is closed
        if (tempSource.close) {
          await tempSource.close();
        }
      }
    }
    
    // Reset for actual conversion
    const actualSource = await open(shpPath);
    featureCount = 0;
    
    if (useStreaming) {
      // Stream to file for large datasets
      const writeStream = fs.createWriteStream(outputPath);
      writeStream.write('{\n  "type": "FeatureCollection",\n  "features": [\n');
      
      let firstFeature = true;
      while (true) {
        const result = await actualSource.read();
        if (result.done) break;
        
        if (!firstFeature) {
          writeStream.write(',\n');
        }
        firstFeature = false;
        
        // Write feature as compact JSON (no pretty printing for large files)
        writeStream.write('    ' + JSON.stringify(result.value));
        
        featureCount++;
        if (featureCount % 1000 === 0) {
          process.stdout.write(`  Processed ${featureCount} features...\r`);
        }
      }
      
      writeStream.write('\n  ]\n}');
      writeStream.end();
      
      // Wait for stream to finish
      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });
    } else {
      // In-memory approach for smaller files
      const features: any[] = [];
      
      while (true) {
        const result = await actualSource.read();
        if (result.done) break;
        
        features.push(result.value);
        featureCount++;
      }
      
      // Create GeoJSON FeatureCollection
      const geojson = {
        type: 'FeatureCollection',
        features: features,
      };
      
      // Write to file
      fs.writeFileSync(outputPath, JSON.stringify(geojson, null, 2));
    }
    
    const sizeMB = (fs.statSync(outputPath).size / (1024 * 1024)).toFixed(2);
    console.log(`  ✓ Converted ${featureCount} features (${sizeMB} MB)`);
    
    return {
      input: fileName,
      output: path.basename(outputPath),
      featureCount,
      success: true,
    };
  } catch (error: any) {
    console.error(`  ✗ Failed: ${error.message}`);
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
  console.log('Shapefile to GeoJSON Converter');
  console.log('========================================\n');
  
  // Find all .shp files
  const files = fs.readdirSync(SHAPEFILE_DIR);
  const shapefiles = files
    .filter((f) => f.endsWith('.shp'))
    .map((f) => path.join(SHAPEFILE_DIR, f));
  
  console.log(`Found ${shapefiles.length} shapefiles\n`);
  
  const results: ConversionResult[] = [];
  const startTime = Date.now();
  
  // Convert each shapefile
  for (const shpPath of shapefiles) {
    const fileName = path.basename(shpPath, '.shp');
    const outputPath = path.join(GEOJSON_DIR, `${fileName}.geojson`);
    
    // Skip if already converted
    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`Skipping ${fileName} (already exists, ${sizeMB} MB)`);
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
  
  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);
  const totalFeatures = results.reduce((sum, r) => sum + r.featureCount, 0);
  
  console.log(`Summary:`);
  console.log(`  Successful: ${successful.length}`);
  console.log(`  Failed: ${failed.length}`);
  console.log(`  Total features: ${totalFeatures.toLocaleString()}`);
  console.log(`  Total time: ${duration} minutes\n`);
  
  // List all GeoJSON files
  const geojsonFiles = fs.readdirSync(GEOJSON_DIR).filter((f) => f.endsWith('.geojson'));
  let totalSize = 0;
  
  console.log(`GeoJSON files (${geojsonFiles.length}):`);
  for (const file of geojsonFiles) {
    const filePath = path.join(GEOJSON_DIR, file);
    const stats = fs.statSync(filePath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    totalSize += stats.size;
    console.log(`  ${file}: ${sizeMB} MB`);
  }
  
  const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
  console.log(`  Total: ${totalSizeMB} MB\n`);
  
  if (failed.length > 0) {
    console.log('Failed conversions:');
    for (const result of failed) {
      console.log(`  ${result.input}: ${result.error}`);
    }
  }
  
  console.log(`\nGeoJSON files saved to: ${GEOJSON_DIR}`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

