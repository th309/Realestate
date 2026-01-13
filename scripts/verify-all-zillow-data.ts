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

async function testZillowData() {
  console.log('=== Testing Zillow Data APIs ===\n');

  // Test State data
  console.log('--- State Data ---');
  const { data: stateData, count: stateCount } = await supabase
    .from('zillow_state')
    .select('region_id, region_name, state_code, value, period_date', { count: 'exact' })
    .eq('metric_name', 'zhvi')
    .order('period_date', { ascending: false })
    .limit(5);

  console.log(`Total records: ${stateCount}`);
  stateData?.forEach(r => console.log(`  ${r.region_name}: $${Math.round(r.value || 0).toLocaleString()}`));

  // Test Metro data
  console.log('\n--- Metro Data ---');
  const { data: metroData, count: metroCount } = await supabase
    .from('zillow_metro')
    .select('region_id, region_name, state_code, cbsa_code, value, period_date', { count: 'exact' })
    .eq('metric_name', 'zhvi')
    .order('period_date', { ascending: false })
    .limit(5);

  console.log(`Total records: ${metroCount}`);
  metroData?.forEach(r => console.log(`  ${r.region_name} (${r.cbsa_code}): $${Math.round(r.value || 0).toLocaleString()}`));

  // Test County data
  console.log('\n--- County Data ---');
  const { data: countyData, count: countyCount } = await supabase
    .from('zillow_county')
    .select('region_id, region_name, state_code, fips_code, value, period_date', { count: 'exact' })
    .eq('metric_name', 'zhvi')
    .order('period_date', { ascending: false })
    .limit(5);

  console.log(`Total records: ${countyCount}`);
  countyData?.forEach(r => console.log(`  ${r.region_name}, ${r.state_code} (${r.fips_code}): $${Math.round(r.value || 0).toLocaleString()}`));

  // Test ZIP data for CA
  console.log('\n--- ZIP Data (CA) ---');
  const { data: zipData, count: zipCount } = await supabase
    .from('zillow_zip')
    .select('region_id, region_name, state_code, value, period_date', { count: 'exact' })
    .eq('state_code', 'CA')
    .eq('metric_name', 'zhvi')
    .order('period_date', { ascending: false })
    .limit(5);

  console.log(`CA ZIP records: ${zipCount}`);
  zipData?.forEach(r => console.log(`  ZIP ${r.region_name}: $${Math.round(r.value || 0).toLocaleString()}`));

  // Test City data for TX
  console.log('\n--- City Data (TX) ---');
  const { data: cityData, count: cityCount } = await supabase
    .from('zillow_city')
    .select('region_id, region_name, state_code, value, period_date', { count: 'exact' })
    .eq('state_code', 'TX')
    .eq('metric_name', 'zhvi')
    .order('period_date', { ascending: false })
    .limit(5);

  console.log(`TX City records: ${cityCount}`);
  cityData?.forEach(r => console.log(`  ${r.region_name}, TX: $${Math.round(r.value || 0).toLocaleString()}`));

  console.log('\n=== All Zillow data tables verified! ===');
}

testZillowData().catch(console.error);
