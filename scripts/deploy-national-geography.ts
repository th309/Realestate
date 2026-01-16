/**
 * Deploy National Geography
 *
 * 1. Creates tiger_national table with PostGIS geometry
 * 2. Loads national boundary shapefile into tiger_national table
 * 3. Creates get_national_geojson() RPC function
 */
import { createClient } from '@supabase/supabase-js';
import { join } from 'path';
import { config } from 'dotenv';
import { loadGeographicFile } from './shapefile-loader/loader';
import { loadEnvironment } from './shapefile-loader/env-loader';

// Load environment variables
config({ path: join(__dirname, '../.env.local') });
config({ path: join(__dirname, '../packages/frontend/.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function executeSQL(query: string, description: string): Promise<boolean> {
  console.log(`   Executing: ${description}...`);
  const { error } = await supabase.rpc('exec_sql', { query });
  if (error) {
    console.log(`      ❌ Error: ${error.message}`);
    return false;
  }
  console.log(`      ✅ Success`);
  return true;
}

async function createTigerNationalTable(): Promise<boolean> {
  console.log('\n=== Step 1: Creating tiger_national Table ===\n');

  // Drop existing table if exists
  await executeSQL('DROP TABLE IF EXISTS tiger_national CASCADE', 'Drop existing table');

  // Create the table with PostGIS geometry (same as other tiger tables)
  const createTableSQL = `
    CREATE TABLE tiger_national (
      ogc_fid SERIAL PRIMARY KEY,
      geoid VARCHAR(2) UNIQUE NOT NULL,
      name VARCHAR(100),
      affgeoid VARCHAR(11),
      geometry GEOMETRY(MULTIPOLYGON, 4326)
    )
  `;
  const created = await executeSQL(createTableSQL, 'Create tiger_national table');

  if (created) {
    // Create spatial index
    await executeSQL(
      'CREATE INDEX idx_tiger_national_geometry ON tiger_national USING GIST (geometry)',
      'Create spatial index'
    );

    // Enable RLS
    await executeSQL('ALTER TABLE tiger_national ENABLE ROW LEVEL SECURITY', 'Enable RLS');

    // Create read policy for all users (using TO PUBLIC)
    await executeSQL(
      `CREATE POLICY "Allow public read access" ON tiger_national FOR SELECT TO PUBLIC USING (true)`,
      'Create public read policy'
    );

    // Grant permissions to all roles
    await executeSQL('GRANT SELECT ON tiger_national TO anon, authenticated, service_role', 'Grant select permissions');
    await executeSQL('GRANT ALL ON tiger_national TO service_role', 'Grant all to service_role');
    await executeSQL('GRANT USAGE, SELECT ON SEQUENCE tiger_national_ogc_fid_seq TO service_role', 'Grant sequence permissions');
  }

  return created;
}

async function loadNationalShapefile(): Promise<boolean> {
  console.log('\n=== Step 2: Loading National Shapefile ===\n');

  loadEnvironment();

  const shapefilePath = join(__dirname, '../data/tiger/cb_2024_us_nation_5m.shp');

  try {
    const result = await loadGeographicFile(shapefilePath, 'tiger_national', {
      geoidField: 'GEOID',
      geometryColumn: 'geometry'
    });

    if (result.success) {
      console.log(`\n   ✅ Successfully loaded ${result.loaded} records`);
      return true;
    } else {
      console.log(`\n   ❌ Loaded ${result.loaded} with ${result.errors} errors`);
      if (result.errorMessages && result.errorMessages.length > 0) {
        console.log('   Error messages:', result.errorMessages.slice(0, 3));
      }
      return result.loaded > 0;
    }
  } catch (error: any) {
    console.error('   ❌ Failed to load shapefile:', error.message);
    return false;
  }
}

async function createRPCFunction(): Promise<boolean> {
  console.log('\n=== Step 3: Creating get_national_geojson() Function ===\n');

  // Use ST_AsGeoJSON to convert geometry to JSON (same pattern as other tiger RPC functions)
  const functionSQL = `
    CREATE OR REPLACE FUNCTION get_national_geojson()
    RETURNS JSON
    LANGUAGE SQL
    STABLE
    AS 'SELECT json_build_object(
      ''type'', ''FeatureCollection'',
      ''features'', COALESCE(
        json_agg(
          json_build_object(
            ''type'', ''Feature'',
            ''geometry'', ST_AsGeoJSON(geometry)::json,
            ''properties'', json_build_object(
              ''GEOID'', geoid,
              ''NAME'', name,
              ''AFFGEOID'', affgeoid
            )
          )
        ),
        ''[]''::json
      )
    )
    FROM tiger_national
    WHERE geometry IS NOT NULL'
  `;

  const created = await executeSQL(functionSQL, 'Create get_national_geojson function');

  if (created) {
    await executeSQL(
      'GRANT EXECUTE ON FUNCTION get_national_geojson() TO anon, authenticated, service_role',
      'Grant execute permissions'
    );

    await executeSQL(
      `COMMENT ON FUNCTION get_national_geojson() IS 'Returns US national boundary as GeoJSON FeatureCollection for map display'`,
      'Add function comment'
    );
  }

  return created;
}

async function verifyDeployment(): Promise<void> {
  console.log('\n=== Step 4: Verifying Deployment ===\n');

  // Check tiger_national table
  const { data: nationalData, error: nationalError } = await supabase
    .from('tiger_national')
    .select('geoid, name')
    .limit(1);

  if (nationalError) {
    console.log('   ❌ tiger_national table error:', nationalError.message);
  } else {
    console.log(`   ✅ tiger_national table: ${nationalData?.length || 0} records`);
    if (nationalData && nationalData.length > 0) {
      console.log(`      GEOID: ${nationalData[0].geoid}, Name: ${nationalData[0].name}`);
    }
  }

  // Check RPC function
  const { data: geojsonData, error: geojsonError } = await supabase.rpc('get_national_geojson');

  if (geojsonError) {
    console.log('   ❌ get_national_geojson() error:', geojsonError.message);
  } else {
    const featureCount = geojsonData?.features?.length || 0;
    console.log(`   ✅ get_national_geojson(): ${featureCount} features returned`);
    if (featureCount > 0) {
      const props = geojsonData.features[0].properties;
      console.log(`      Feature: ${props?.NAME} (${props?.GEOID})`);
    }
  }
}

async function main() {
  console.log('================================================');
  console.log('   Deploy National Geography to Supabase');
  console.log('================================================');

  const step1Success = await createTigerNationalTable();
  if (!step1Success) {
    console.log('\n❌ Failed to create table. Aborting.');
    process.exit(1);
  }

  const step2Success = await loadNationalShapefile();
  if (!step2Success) {
    console.log('\n⚠️  Shapefile loading had issues, but continuing...');
  }

  const step3Success = await createRPCFunction();
  if (!step3Success) {
    console.log('\n⚠️  RPC function creation had issues.');
  }

  await verifyDeployment();

  console.log('\n================================================');
  console.log('   Deployment Complete');
  console.log('================================================\n');

  if (step1Success && step2Success && step3Success) {
    console.log('✅ All steps completed successfully!');
    console.log('\nThe national GeoJSON is now available via:');
    console.log('   supabase.rpc(\'get_national_geojson\')');
  } else {
    console.log('⚠️  Some steps had errors. Check the output above.');
  }
}

main().catch(console.error);
