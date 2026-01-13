/**
 * Check tiger_* tables for geometry data
 * Phase 0: Verify database state before implementing GeoJSON API
 */
import { createClient } from '@supabase/supabase-js';
import { fetch as undiciFetch, Agent } from 'undici';

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

async function checkTigerTables() {
  console.log('=== Tiger Tables Check ===\n');

  // Check tiger tables
  const tigerTables = [
    'tiger_states',
    'tiger_counties',
    'tiger_cbsa',
    'tiger_places',
    'tiger_zcta',
    'tiger_tracts'
  ];

  console.log('TIGER GEOMETRY TABLES:');
  console.log('-'.repeat(50));

  for (const table of tigerTables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log(`  ${table}: ❌ ERROR - ${error.message}`);
    } else {
      const status = count && count > 0 ? '✅' : '⚠️ EMPTY';
      console.log(`  ${table}: ${status} ${count} rows`);
    }
  }

  // Sample data from tables that have data
  console.log('\n' + '='.repeat(50));
  console.log('SAMPLE DATA (checking columns and geometry):');
  console.log('='.repeat(50));

  // Check tiger_states columns
  console.log('\ntiger_states sample:');
  const { data: statesData, error: statesErr } = await supabase
    .from('tiger_states')
    .select('*')
    .limit(2);

  if (statesErr) {
    console.log(`  Error: ${statesErr.message}`);
  } else if (statesData && statesData.length > 0) {
    console.log(`  Columns: ${Object.keys(statesData[0]).join(', ')}`);
    console.log(`  Sample row:`, JSON.stringify(statesData[0], null, 2).substring(0, 500));
  } else {
    console.log('  No data');
  }

  // Check tiger_cbsa columns
  console.log('\ntiger_cbsa sample:');
  const { data: cbsaData, error: cbsaErr } = await supabase
    .from('tiger_cbsa')
    .select('*')
    .limit(2);

  if (cbsaErr) {
    console.log(`  Error: ${cbsaErr.message}`);
  } else if (cbsaData && cbsaData.length > 0) {
    console.log(`  Columns: ${Object.keys(cbsaData[0]).join(', ')}`);
    console.log(`  Sample row:`, JSON.stringify(cbsaData[0], null, 2).substring(0, 500));
  } else {
    console.log('  No data');
  }

  // Check tiger_counties columns
  console.log('\ntiger_counties sample:');
  const { data: countiesData, error: countiesErr } = await supabase
    .from('tiger_counties')
    .select('*')
    .limit(2);

  if (countiesErr) {
    console.log(`  Error: ${countiesErr.message}`);
  } else if (countiesData && countiesData.length > 0) {
    console.log(`  Columns: ${Object.keys(countiesData[0]).join(', ')}`);
    console.log(`  Sample row:`, JSON.stringify(countiesData[0], null, 2).substring(0, 500));
  } else {
    console.log('  No data');
  }

  // Check tiger_zcta columns
  console.log('\ntiger_zcta sample:');
  const { data: zctaData, error: zctaErr } = await supabase
    .from('tiger_zcta')
    .select('*')
    .limit(2);

  if (zctaErr) {
    console.log(`  Error: ${zctaErr.message}`);
  } else if (zctaData && zctaData.length > 0) {
    console.log(`  Columns: ${Object.keys(zctaData[0]).join(', ')}`);
    console.log(`  Sample row:`, JSON.stringify(zctaData[0], null, 2).substring(0, 500));
  } else {
    console.log('  No data');
  }

  // Check tiger_places columns
  console.log('\ntiger_places sample:');
  const { data: placesData, error: placesErr } = await supabase
    .from('tiger_places')
    .select('*')
    .limit(2);

  if (placesErr) {
    console.log(`  Error: ${placesErr.message}`);
  } else if (placesData && placesData.length > 0) {
    console.log(`  Columns: ${Object.keys(placesData[0]).join(', ')}`);
    console.log(`  Sample row:`, JSON.stringify(placesData[0], null, 2).substring(0, 500));
  } else {
    console.log('  No data');
  }

  console.log('\n' + '='.repeat(50));
  console.log('CHECK COMPLETE');
  console.log('='.repeat(50));
}

checkTigerTables().catch(console.error);
