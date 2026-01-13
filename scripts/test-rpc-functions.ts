import { createClient } from '@supabase/supabase-js';
import { fetch as undiciFetch, Agent } from 'undici';

const agent = new Agent({
  keepAliveTimeout: 10_000,
  keepAliveMaxTimeout: 30_000,
  connect: { timeout: 60_000 },
});

const customFetch = (url: string | URL | Request, init?: RequestInit) => {
  return undiciFetch(url as any, { ...init, dispatcher: agent } as any);
};

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I',
  {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: customFetch as unknown as typeof fetch },
  }
);

async function testRpcFunctions() {
  console.log('=== Testing GeoJSON RPC Functions ===\n');

  // Test get_states_geojson
  console.log('1. Testing get_states_geojson...');
  const { data: statesData, error: statesError } = await supabase.rpc('get_states_geojson');
  if (statesError) {
    console.log('   ERROR:', statesError.message);
  } else {
    console.log('   Success! Features:', statesData?.features?.length || 0);
    if (statesData?.features?.[0]) {
      console.log('   Sample:', JSON.stringify(statesData.features[0].properties).substring(0, 100));
    }
  }

  // Test get_metros_geojson
  console.log('\n2. Testing get_metros_geojson...');
  const { data: metrosData, error: metrosError } = await supabase.rpc('get_metros_geojson');
  if (metrosError) {
    console.log('   ERROR:', metrosError.message);
  } else {
    console.log('   Success! Features:', metrosData?.features?.length || 0);
    if (metrosData?.features?.[0]) {
      console.log('   Sample:', JSON.stringify(metrosData.features[0].properties).substring(0, 100));
    }
  }

  // Test get_counties_geojson
  console.log('\n3. Testing get_counties_geojson...');
  const { data: countiesData, error: countiesError } = await supabase.rpc('get_counties_geojson');
  if (countiesError) {
    console.log('   ERROR:', countiesError.message);
  } else {
    console.log('   Success! Features:', countiesData?.features?.length || 0);
  }

  // Test get_counties_geojson_by_state
  console.log('\n4. Testing get_counties_geojson_by_state (CA)...');
  const { data: caCounties, error: caCountiesError } = await supabase.rpc('get_counties_geojson_by_state', {
    p_state_abbrev: 'CA'
  });
  if (caCountiesError) {
    console.log('   ERROR:', caCountiesError.message);
  } else {
    console.log('   Success! Features:', caCounties?.features?.length || 0);
  }

  // Test get_zcta_geojson_by_state
  console.log('\n5. Testing get_zcta_geojson_by_state (CA)...');
  const { data: caZcta, error: caZctaError } = await supabase.rpc('get_zcta_geojson_by_state', {
    p_state_abbrev: 'CA'
  });
  if (caZctaError) {
    console.log('   ERROR:', caZctaError.message);
  } else {
    console.log('   Success! Features:', caZcta?.features?.length || 0);
  }

  // Check if tiger tables have data
  console.log('\n=== Checking TIGER Tables ===\n');

  const { count: stateCount } = await supabase.from('tiger_state').select('*', { count: 'exact', head: true });
  console.log('tiger_state rows:', stateCount);

  const { count: countyCount } = await supabase.from('tiger_county').select('*', { count: 'exact', head: true });
  console.log('tiger_county rows:', countyCount);

  const { count: cbsaCount } = await supabase.from('tiger_cbsa').select('*', { count: 'exact', head: true });
  console.log('tiger_cbsa rows:', cbsaCount);

  const { count: zctaCount } = await supabase.from('tiger_zcta').select('*', { count: 'exact', head: true });
  console.log('tiger_zcta rows:', zctaCount);

  // Sample tiger_state to see schema
  console.log('\n=== Sample tiger_state record ===');
  const { data: sampleState } = await supabase.from('tiger_state').select('*').limit(1);
  if (sampleState?.[0]) {
    const record = sampleState[0];
    console.log('Columns:', Object.keys(record).join(', '));
    // Don't print geometry, just other props
    const { geom, ...rest } = record;
    console.log('Sample data:', JSON.stringify(rest).substring(0, 200));
  }
}

testRpcFunctions().catch(console.error);
