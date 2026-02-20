/**
 * Debug GeoJSON RPC function issues
 */
import { createClient } from '@supabase/supabase-js';
import { fetch as undiciFetch, Agent } from 'undici';

const agent = new Agent({
  keepAliveTimeout: 10_000,
  keepAliveMaxTimeout: 30_000,
  connect: { timeout: 30_000 },
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

async function debug() {
  console.log('=== Debugging GeoJSON Functions ===\n');

  // Check CA state lookup
  console.log('1. Checking tiger_states for CA...');
  const { data: caState, error: caErr } = await supabase
    .from('tiger_states')
    .select('geoid, name, state_abbreviation')
    .ilike('state_abbreviation', 'CA')
    .single();

  if (caErr) {
    console.log(`   Error: ${caErr.message}`);
  } else {
    console.log(`   Found: geoid=${caState.geoid}, name=${caState.name}, abbrev=${caState.state_abbreviation}`);
  }

  // Check if tiger_places has state_fips matching CA's geoid
  console.log('\n2. Checking tiger_places for CA (state_fips = "06")...');
  const { data: caPlaces, error: placesErr, count: placesCount } = await supabase
    .from('tiger_places')
    .select('geoid, name, state_fips', { count: 'exact' })
    .eq('state_fips', '06')
    .limit(5);

  if (placesErr) {
    console.log(`   Error: ${placesErr.message}`);
  } else {
    console.log(`   Found ${placesCount} places with state_fips='06'`);
    if (caPlaces && caPlaces.length > 0) {
      console.log(`   Sample: ${JSON.stringify(caPlaces.slice(0, 3))}`);
    }
  }

  // Check what state_fips values exist in tiger_places
  console.log('\n3. Checking distinct state_fips values in tiger_places...');
  const { data: distinctFips } = await supabase
    .from('tiger_places')
    .select('state_fips')
    .limit(1000);

  if (distinctFips) {
    const uniqueFips = [...new Set(distinctFips.map(d => d.state_fips))].sort();
    console.log(`   Found ${uniqueFips.length} distinct state_fips values`);
    console.log(`   Sample values: ${uniqueFips.slice(0, 10).join(', ')}`);
    console.log(`   Contains null?: ${uniqueFips.includes(null)}`);
  }

  // Check tiger_zcta for CA
  console.log('\n4. Checking tiger_zcta for CA (default_state = "CA")...');
  const { data: caZcta, error: zctaErr, count: zctaCount } = await supabase
    .from('tiger_zcta')
    .select('geoid, default_state', { count: 'exact' })
    .ilike('default_state', 'CA')
    .limit(5);

  if (zctaErr) {
    console.log(`   Error: ${zctaErr.message}`);
  } else {
    console.log(`   Found ${zctaCount} ZCTAs with default_state='CA'`);
    if (caZcta && caZcta.length > 0) {
      console.log(`   Sample: ${JSON.stringify(caZcta)}`);
    }
  }

  // Check distinct default_state values
  console.log('\n5. Checking distinct default_state values in tiger_zcta...');
  const { data: distinctStates } = await supabase
    .from('tiger_zcta')
    .select('default_state')
    .limit(1000);

  if (distinctStates) {
    const uniqueStates = [...new Set(distinctStates.map(d => d.default_state))].sort();
    console.log(`   Found ${uniqueStates.length} distinct default_state values`);
    console.log(`   Sample values: ${uniqueStates.slice(0, 20).join(', ')}`);
  }

  // Test a smaller county query (just AL)
  console.log('\n6. Testing counties for a single state (AL)...');
  const { data: alCounties, error: alErr, count: alCount } = await supabase
    .from('tiger_counties')
    .select('geoid, name', { count: 'exact' })
    .eq('state_fips', '01')
    .limit(5);

  if (alErr) {
    console.log(`   Error: ${alErr.message}`);
  } else {
    console.log(`   Found ${alCount} counties in AL`);
    if (alCounties) {
      console.log(`   Sample: ${JSON.stringify(alCounties)}`);
    }
  }
}

debug().catch(console.error);
