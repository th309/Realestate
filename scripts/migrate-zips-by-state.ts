/**
 * Migrate ZIP data from zillow_zhvi to zillow_zip by state
 */
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

// States we still need to migrate (excluding ones already done: AK, AL, AR, AZ, CA)
const STATES = [
  'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN',
  'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS',
  'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND',
  'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT',
  'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

async function migrateByState() {
  let grandTotal = 0;

  for (const state of STATES) {
    // Get ZIP codes for this state from crosswalk
    const { data: zips } = await supabase
      .from('geography_crosswalk')
      .select('zip_code')
      .eq('state_abbrev', state)
      .not('zip_code', 'is', null)
      .limit(3000);

    if (!zips || zips.length === 0) {
      console.log(`${state}: no ZIPs in crosswalk`);
      continue;
    }

    const zipCodes = [...new Set(zips.map(z => z.zip_code))];

    // Fetch Zillow data for these ZIPs
    const { data: zhviData, error } = await supabase
      .from('zillow_zhvi')
      .select('region_id, date, value')
      .eq('geography', 'Zip')
      .eq('property_type', 'sfrcondo')
      .eq('tier', '0.33_0.67')
      .eq('date', '2025-11-30')
      .in('region_id', zipCodes);

    if (error) {
      console.log(`${state}: fetch error - ${error.message}`);
      continue;
    }

    if (!zhviData || zhviData.length === 0) {
      console.log(`${state}: no ZHVI data`);
      continue;
    }

    // Insert with state_code
    const records = zhviData.map(z => ({
      region_id: parseInt(z.region_id),
      region_name: z.region_id,
      state_code: state,
      period_date: z.date,
      metric_name: 'zhvi',
      value: z.value,
    }));

    const { error: insertError } = await supabase
      .from('zillow_zip')
      .upsert(records, { onConflict: 'region_id,period_date,metric_name' });

    if (insertError) {
      console.log(`${state}: insert error - ${insertError.message}`);
      continue;
    }

    grandTotal += records.length;
    console.log(`${state}: ${records.length} ZIPs (total: ${grandTotal})`);
  }

  console.log('');
  console.log('Migration complete. Total added:', grandTotal);

  // Check final count and state coverage
  const { count } = await supabase.from('zillow_zip').select('*', { count: 'exact', head: true });
  console.log('Total records in zillow_zip:', count);

  const { data: stateData } = await supabase
    .from('zillow_zip')
    .select('state_code')
    .not('state_code', 'is', null);

  const states = [...new Set(stateData?.map(d => d.state_code) || [])].sort();
  console.log('States covered:', states.length);
  console.log(states.join(', '));
}

migrateByState().catch(console.error);
