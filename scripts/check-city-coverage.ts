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
  process.env.SUPABASE_SERVICE_KEY || (() => { throw new Error('SUPABASE_SERVICE_KEY is required'); })(),
  {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: customFetch as unknown as typeof fetch },
  }
);

async function checkCityCoverage() {
  console.log('=== Analyzing City data coverage ===\n');

  // Get total count
  const { count } = await supabase
    .from('zillow_city')
    .select('*', { count: 'exact', head: true });

  console.log(`Total records in zillow_city: ${count}`);

  // Paginate to get all states
  const pageSize = 1000;
  let page = 0;
  const allStates = new Set<string>();
  const allCities = new Set<string>();

  while (true) {
    const { data } = await supabase
      .from('zillow_city')
      .select('region_name, state_code')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (!data || data.length === 0) break;

    data.forEach(r => {
      if (r.state_code) allStates.add(r.state_code);
      if (r.region_name) allCities.add(r.region_name);
    });

    if (data.length < pageSize) break;
    page++;
  }

  console.log(`\nUnique states in zillow_city (${allStates.size}):`);
  console.log([...allStates].sort().join(', '));

  console.log(`\nUnique cities: ${allCities.size}`);

  // Sample some cities
  const { data: sample } = await supabase
    .from('zillow_city')
    .select('region_name, state_code, value')
    .limit(10);

  console.log('\nSample cities:');
  sample?.forEach(r => console.log(`  ${r.region_name}, ${r.state_code}: $${Math.round(r.value || 0).toLocaleString()}`));
}

checkCityCoverage().catch(console.error);
