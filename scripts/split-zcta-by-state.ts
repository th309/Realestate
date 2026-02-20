import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || (() => { throw new Error('SUPABASE_SERVICE_KEY is required'); })(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function splitZctaByState() {
  console.log('Loading ZCTA GeoJSON...');
  const geojsonPath = 'D:/Projects/rei-platform/packages/frontend/public/geojson/zcta_2023.json';
  const geojson = JSON.parse(fs.readFileSync(geojsonPath, 'utf-8'));

  console.log(`Loaded ${geojson.features.length} ZCTA features`);

  // Build ZIP -> State mapping from crosswalk with pagination
  console.log('Building ZIP to State mapping from crosswalk...');
  const zipToState = new Map<string, string>();
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const { data } = await supabase
      .from('geography_crosswalk')
      .select('zip_code, state_abbrev')
      .not('zip_code', 'is', null)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (!data || data.length === 0) break;

    data.forEach(row => {
      if (row.zip_code && row.state_abbrev) {
        zipToState.set(row.zip_code, row.state_abbrev);
      }
    });

    page++;
    console.log(`  Loaded ${page * pageSize} crosswalk rows...`);
    if (data.length < pageSize) break;
  }

  console.log(`Built mapping for ${zipToState.size} ZIP codes`);

  // Group features by state
  const featuresByState = new Map<string, any[]>();
  let unmapped = 0;
  let nullGeometry = 0;

  geojson.features.forEach((feature: any) => {
    // Skip features without geometry
    if (!feature.geometry) {
      nullGeometry++;
      return;
    }

    const zcta = feature.properties.ZCTA5CE20 || feature.properties.GEOID20;
    const state = zipToState.get(zcta);

    if (state) {
      if (!featuresByState.has(state)) {
        featuresByState.set(state, []);
      }
      featuresByState.get(state)!.push(feature);
    } else {
      unmapped++;
    }
  });

  console.log(`\nGrouped features by state:`);
  console.log(`  States found: ${featuresByState.size}`);
  console.log(`  Features with null geometry: ${nullGeometry}`);
  console.log(`  Unmapped ZCTAs: ${unmapped}`);

  // Create output directory
  const outputDir = 'D:/Projects/rei-platform/packages/frontend/public/geojson/zcta';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write state-specific GeoJSON files
  console.log('\nWriting state GeoJSON files...');
  for (const [state, features] of featuresByState) {
    const stateGeojson = {
      type: 'FeatureCollection',
      features: features
    };

    const outputPath = path.join(outputDir, `${state.toLowerCase()}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(stateGeojson));

    const sizeKb = Math.round(fs.statSync(outputPath).size / 1024);
    console.log(`  ${state}: ${features.length} ZCTAs (${sizeKb} KB)`);
  }

  console.log('\nDone! State GeoJSON files written to:', outputDir);
}

splitZctaByState().catch(console.error);
