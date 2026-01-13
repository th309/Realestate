/**
 * Run migration 036 - Create GeoJSON RPC functions
 */
import { createClient } from '@supabase/supabase-js';
import { fetch as undiciFetch, Agent } from 'undici';
import * as fs from 'fs';
import * as path from 'path';

// Create a custom agent with connection handling
const agent = new Agent({
  keepAliveTimeout: 10_000,
  keepAliveMaxTimeout: 30_000,
  connect: {
    timeout: 30_000,
  },
});

// Custom fetch wrapper using undici
const customFetch = (url: string | URL | Request, init?: RequestInit) => {
  return undiciFetch(url as any, {
    ...init,
    dispatcher: agent,
  } as any);
};

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: customFetch as unknown as typeof fetch,
    },
  }
);

async function runMigration() {
  console.log('=== Running Migration 036: GeoJSON RPC Functions ===\n');

  // Read migration SQL
  const migrationPath = path.join(__dirname, 'migrations', '036-create-geojson-rpc-functions.sql');
  const sql = fs.readFileSync(migrationPath, 'utf-8');

  // Split into individual statements
  // Match: CREATE OR REPLACE FUNCTION ... $$ or GRANT ... or COMMENT ...
  const functionPattern = /CREATE OR REPLACE FUNCTION[\s\S]*?\$\$;/gi;
  const grantPattern = /GRANT[\s\S]*?;/gi;
  const commentPattern = /COMMENT ON FUNCTION[\s\S]*?;/gi;

  const functions = sql.match(functionPattern) || [];
  const grants = sql.match(grantPattern) || [];
  const comments = sql.match(commentPattern) || [];

  const statements = [...functions, ...grants, ...comments];

  console.log(`Found ${statements.length} SQL statements to execute`);
  console.log(`  - ${functions.length} functions`);
  console.log(`  - ${grants.length} grants`);
  console.log(`  - ${comments.length} comments`);
  console.log('');

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.substring(0, 60).replace(/\n/g, ' ') + '...';

    console.log(`[${i + 1}/${statements.length}] Executing: ${preview}`);

    const { error } = await supabase.rpc('exec_sql', { query: stmt });

    if (error) {
      console.log(`   ❌ Error: ${error.message}`);
      errorCount++;
    } else {
      console.log(`   ✅ Success`);
      successCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`Migration complete: ${successCount} succeeded, ${errorCount} failed`);
  console.log('='.repeat(50));

  // Test the functions
  if (errorCount === 0 || successCount > 0) {
    console.log('\n=== Testing RPC Functions ===\n');

    // Test get_states_geojson
    console.log('Testing get_states_geojson()...');
    const { data: statesData, error: statesErr } = await supabase.rpc('get_states_geojson');
    if (statesErr) {
      console.log(`   ❌ Error: ${statesErr.message}`);
    } else {
      const featureCount = statesData?.features?.length || 0;
      console.log(`   ✅ Success: ${featureCount} features returned`);
      if (featureCount > 0) {
        console.log(`   Sample properties: ${JSON.stringify(statesData.features[0].properties)}`);
      }
    }

    // Test get_metros_geojson
    console.log('\nTesting get_metros_geojson()...');
    const { data: metrosData, error: metrosErr } = await supabase.rpc('get_metros_geojson');
    if (metrosErr) {
      console.log(`   ❌ Error: ${metrosErr.message}`);
    } else {
      const featureCount = metrosData?.features?.length || 0;
      console.log(`   ✅ Success: ${featureCount} features returned`);
      if (featureCount > 0) {
        console.log(`   Sample properties: ${JSON.stringify(metrosData.features[0].properties)}`);
      }
    }

    // Test get_counties_geojson
    console.log('\nTesting get_counties_geojson()...');
    const { data: countiesData, error: countiesErr } = await supabase.rpc('get_counties_geojson');
    if (countiesErr) {
      console.log(`   ❌ Error: ${countiesErr.message}`);
    } else {
      const featureCount = countiesData?.features?.length || 0;
      console.log(`   ✅ Success: ${featureCount} features returned`);
      if (featureCount > 0) {
        console.log(`   Sample feature ID: ${countiesData.features[0].id}`);
        console.log(`   Sample properties: ${JSON.stringify(countiesData.features[0].properties)}`);
      }
    }

    // Test get_zcta_geojson_by_state
    console.log('\nTesting get_zcta_geojson_by_state(CA)...');
    const { data: zctaData, error: zctaErr } = await supabase.rpc('get_zcta_geojson_by_state', { p_state_abbrev: 'CA' });
    if (zctaErr) {
      console.log(`   ❌ Error: ${zctaErr.message}`);
    } else {
      const featureCount = zctaData?.features?.length || 0;
      console.log(`   ✅ Success: ${featureCount} features returned`);
      if (featureCount > 0) {
        console.log(`   Sample properties: ${JSON.stringify(zctaData.features[0].properties)}`);
      }
    }

    // Test get_places_geojson_by_state
    console.log('\nTesting get_places_geojson_by_state(CA)...');
    const { data: placesData, error: placesErr } = await supabase.rpc('get_places_geojson_by_state', { p_state_abbrev: 'CA' });
    if (placesErr) {
      console.log(`   ❌ Error: ${placesErr.message}`);
    } else {
      const featureCount = placesData?.features?.length || 0;
      console.log(`   ✅ Success: ${featureCount} features returned`);
      if (featureCount > 0) {
        console.log(`   Sample properties: ${JSON.stringify(placesData.features[0].properties)}`);
      }
    }
  }
}

runMigration().catch(console.error);
