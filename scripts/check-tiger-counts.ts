import { createClient } from '@supabase/supabase-js';
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

async function checkCounts() {
  console.log('=== Tiger Table Counts ===\n');

  const tables = [
    { name: 'tiger_states', filter: null },
    { name: 'tiger_counties', filter: null },
    { name: 'tiger_cbsa', filter: null },
    { name: 'tiger_zcta', filter: null },
    { name: 'tiger_places', filter: null },
  ];

  for (const t of tables) {
    const { count, error } = await supabase
      .from(t.name)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log(`${t.name}: Error - ${error.message}`);
    } else {
      console.log(`${t.name}: ${count?.toLocaleString()} records`);
    }
  }

  // Check ZCTA count for specific states
  console.log('\n=== ZCTAs by State ===');
  for (const state of ['CA', 'TX', 'NY', 'FL', 'WY']) {
    const { count } = await supabase
      .from('tiger_zcta')
      .select('*', { count: 'exact', head: true })
      .eq('default_state', state);
    console.log(`  ${state}: ${count?.toLocaleString() || 0} ZCTAs`);
  }

  // Test a simple ZCTA query for WY (smallest)
  console.log('\n=== Testing Small State ZCTA Query (WY) ===');
  const { data: wyZcta, error: wyError } = await supabase.rpc('get_zcta_geojson_by_state', {
    p_state_abbrev: 'WY'
  });
  if (wyError) {
    console.log('WY Error:', wyError.message);
  } else {
    console.log('WY Success! Features:', wyZcta?.features?.length || 0);
  }

  // Test a simple places query
  console.log('\n=== Testing Small State Places Query (WY) ===');
  const { data: wyPlaces, error: wyPlacesError } = await supabase.rpc('get_places_geojson_by_state', {
    p_state_abbrev: 'WY'
  });
  if (wyPlacesError) {
    console.log('WY Places Error:', wyPlacesError.message);
  } else {
    console.log('WY Places Success! Features:', wyPlaces?.features?.length || 0);
  }
}

checkCounts().catch(console.error);
