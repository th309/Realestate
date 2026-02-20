/**
 * Run Migration: Optimize GeoJSON RPC Functions
 * Uses ST_Simplify for national views and fixes column names
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fetch as undiciFetch, Agent } from 'undici';

const agent = new Agent({
  keepAliveTimeout: 10_000,
  keepAliveMaxTimeout: 30_000,
  connect: { timeout: 120_000 },
});

const customFetch = (url: string | URL | Request, init?: RequestInit) => {
  return undiciFetch(url as any, { ...init, dispatcher: agent } as any);
};

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || (() => { throw new Error('SUPABASE_SERVICE_KEY is required'); })(),
  {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: customFetch as unknown as typeof fetch },
  }
);

async function runMigration() {
  console.log('=== Optimizing GeoJSON RPC Functions ===\n');

  const sqlPath = join(__dirname, 'migrations', '037-optimize-geojson-rpc-functions.sql');
  const sql = readFileSync(sqlPath, 'utf8');

  // Extract CREATE FUNCTION statements and GRANT statements
  const functionRegex = /CREATE OR REPLACE FUNCTION[\s\S]+?\$\$;/g;
  const grantRegex = /GRANT EXECUTE[^;]+;/g;

  const functions = sql.match(functionRegex) || [];
  const grants = sql.match(grantRegex) || [];

  console.log(`Found ${functions.length} functions and ${grants.length} grants to execute\n`);

  // Execute each function creation
  for (let i = 0; i < functions.length; i++) {
    const stmt = functions[i];
    const funcName = stmt.match(/FUNCTION\s+(\w+)/)?.[1] || 'unknown';
    console.log(`[${i + 1}/${functions.length}] Creating ${funcName}...`);

    const { error } = await supabase.rpc('exec_sql', { query: stmt });

    if (error) {
      console.log(`   ❌ Error: ${error.message}`);
    } else {
      console.log(`   ✅ Success`);
    }
  }

  // Execute grants
  for (let i = 0; i < grants.length; i++) {
    const stmt = grants[i];
    const funcName = stmt.match(/ON FUNCTION\s+(\w+)/)?.[1] || 'unknown';
    console.log(`[${i + 1}/${grants.length}] Granting access to ${funcName}...`);

    const { error } = await supabase.rpc('exec_sql', { query: stmt });

    if (error) {
      console.log(`   ⚠ Warning: ${error.message}`);
    } else {
      console.log(`   ✅ Success`);
    }
  }

  console.log('\n=== Testing Functions ===\n');

  // Test each function
  const tests = [
    { name: 'get_states_geojson', fn: () => supabase.rpc('get_states_geojson') },
    { name: 'get_metros_geojson', fn: () => supabase.rpc('get_metros_geojson') },
    { name: 'get_counties_geojson', fn: () => supabase.rpc('get_counties_geojson') },
    { name: 'get_counties_geojson_by_state(CA)', fn: () => supabase.rpc('get_counties_geojson_by_state', { p_state_abbrev: 'CA' }) },
    { name: 'get_zcta_geojson_by_state(CA)', fn: () => supabase.rpc('get_zcta_geojson_by_state', { p_state_abbrev: 'CA' }) },
    { name: 'get_places_geojson_by_state(CA)', fn: () => supabase.rpc('get_places_geojson_by_state', { p_state_abbrev: 'CA' }) },
  ];

  for (const test of tests) {
    try {
      console.log(`Testing ${test.name}...`);
      const start = Date.now();
      const { data, error } = await test.fn();
      const elapsed = Date.now() - start;

      if (error) {
        console.log(`   ❌ Error: ${error.message}`);
      } else if (data && data.features) {
        console.log(`   ✅ ${data.features.length} features (${elapsed}ms)`);
      } else {
        console.log(`   ✅ Response received (${elapsed}ms)`);
      }
    } catch (err: any) {
      console.log(`   ❌ ${err.message}`);
    }
  }
}

runMigration().catch(console.error);
