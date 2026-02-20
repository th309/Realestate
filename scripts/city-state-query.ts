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

// All US states to check
const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL',
  'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME',
  'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
  'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI',
  'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

async function checkStateByState() {
  console.log('=== Checking City Coverage by State ===\n');

  const found: string[] = [];
  const missing: string[] = [];

  for (const state of US_STATES) {
    const { count } = await supabase
      .from('zillow_city')
      .select('*', { count: 'exact', head: true })
      .eq('state_code', state);

    if (count && count > 0) {
      found.push(`${state}: ${count.toLocaleString()}`);
    } else {
      missing.push(state);
    }
  }

  console.log(`States with data (${found.length}):`);
  found.forEach(s => console.log(`  ${s}`));

  console.log(`\nMissing states (${missing.length}):`);
  console.log(missing.join(', ') || 'None');
}

checkStateByState().catch(console.error);
