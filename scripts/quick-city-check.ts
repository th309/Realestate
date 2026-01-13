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

async function quickCheck() {
  console.log('=== Quick City Coverage Check ===\n');

  // Get total count
  const { count } = await supabase
    .from('zillow_city')
    .select('*', { count: 'exact', head: true });

  console.log(`Total records in zillow_city: ${count?.toLocaleString()}`);

  // Just get a sample of state_codes from the first 5000 records
  const { data } = await supabase
    .from('zillow_city')
    .select('state_code')
    .limit(5000);

  const states = [...new Set(data?.map(r => r.state_code).filter(Boolean) || [])].sort();
  console.log(`\nStates found in sample (5000 records): ${states.length}`);
  console.log(states.join(', '));

  // Also sample from different offsets to get more states
  const moreStates = new Set<string>(states);

  for (const offset of [100000, 500000, 1000000, 2000000, 3000000, 4000000]) {
    const { data: batch } = await supabase
      .from('zillow_city')
      .select('state_code')
      .range(offset, offset + 1000);

    batch?.forEach(r => {
      if (r.state_code) moreStates.add(r.state_code);
    });
  }

  console.log(`\nStates found across all samples: ${moreStates.size}`);
  console.log([...moreStates].sort().join(', '));
}

quickCheck().catch(console.error);
