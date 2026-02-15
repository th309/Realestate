/**
 * Generate simplified static GeoJSON files from the backend API.
 *
 * Usage:
 *   1. Start the backend: cd packages/backend && npm run start:dev
 *   2. Run this script: npx tsx scripts/generate-static-geojson.ts
 *
 * The backend RPCs apply ST_Simplify to reduce file sizes from 70-270 MB
 * down to 1-5 MB — suitable for static serving from the frontend.
 *
 * Generated files go to packages/frontend/public/geojson/
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const OUTPUT_DIR = join(__dirname, '../packages/frontend/public/geojson');

const LAYERS = [
  { name: 'national', endpoint: '/api/geography/national', file: 'national.json' },
  { name: 'states', endpoint: '/api/geography/states', file: 'states.json' },
  { name: 'counties', endpoint: '/api/geography/counties', file: 'counties.json' },
  { name: 'metros', endpoint: '/api/geography/metros', file: 'metros.json' },
];

async function generate() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const layer of LAYERS) {
    console.log(`Fetching ${layer.name} from ${API_URL}${layer.endpoint}...`);
    try {
      const response = await fetch(`${API_URL}${layer.endpoint}`);
      if (!response.ok) {
        console.error(`  Failed (${response.status}): ${response.statusText}`);
        continue;
      }
      const data = await response.json();
      const featureCount = data?.features?.length ?? 0;
      const filePath = join(OUTPUT_DIR, layer.file);
      writeFileSync(filePath, JSON.stringify(data));
      const sizeMB = (Buffer.byteLength(JSON.stringify(data)) / 1024 / 1024).toFixed(2);
      console.log(`  Saved ${filePath} (${featureCount} features, ${sizeMB} MB)`);
    } catch (err: any) {
      console.error(`  Error: ${err.message}`);
    }
  }

  console.log('\nDone. Static GeoJSON files generated.');
  console.log('Per-state files (zips, cities) remain on the backend API (cached 24h).');
}

generate().catch(console.error);
