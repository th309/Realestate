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

async function analyzeCoverage() {
  console.log('=== Analyzing ZIP data coverage ===\n');

  // Get unique states in zillow_zip
  const pageSize = 1000;
  let page = 0;
  const allStates = new Set<string>();
  const allPrefixes = new Set<string>();

  while (true) {
    const { data } = await supabase
      .from('zillow_zip')
      .select('region_name, state_code')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (!data || data.length === 0) break;

    data.forEach(r => {
      if (r.state_code) allStates.add(r.state_code);
      if (r.region_name) allPrefixes.add(r.region_name.substring(0, 3));
    });

    if (data.length < pageSize) break;
    page++;
  }

  console.log(`States in zillow_zip (${allStates.size}):`);
  console.log([...allStates].sort().join(', '));

  console.log(`\nUnique ZIP prefixes (${allPrefixes.size}):`);
  console.log([...allPrefixes].sort().join(', '));

  // Check the source table zillow_zhvi for ZIP data
  console.log('\n=== Checking source data in zillow_zhvi ===\n');

  const { count: zhviZipCount } = await supabase
    .from('zillow_zhvi')
    .select('*', { count: 'exact', head: true })
    .eq('geography', 'Zip');

  console.log(`Total ZIP records in zillow_zhvi: ${zhviZipCount}`);

  // Sample some ZIP region_ids from zillow_zhvi
  const { data: zhviSample } = await supabase
    .from('zillow_zhvi')
    .select('region_id')
    .eq('geography', 'Zip')
    .limit(20);

  console.log('\nSample ZIP region_ids from zillow_zhvi:');
  const samplePrefixes = new Set<string>();
  zhviSample?.forEach(r => {
    console.log(`  ${r.region_id}`);
    samplePrefixes.add(r.region_id.substring(0, 3));
  });

  // Get unique distinct zips from zillow_zhvi to understand coverage
  const { data: distinctZips } = await supabase
    .from('zillow_zhvi')
    .select('region_id')
    .eq('geography', 'Zip')
    .limit(5000);

  const zhviPrefixes = new Set<string>();
  distinctZips?.forEach(r => zhviPrefixes.add(r.region_id.substring(0, 3)));

  console.log(`\nUnique ZIP prefixes in zillow_zhvi (sample of 5000): ${zhviPrefixes.size}`);
}

analyzeCoverage().catch(console.error);
