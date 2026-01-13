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

async function checkSchema() {
  console.log('=== Checking Tiger Tables Schema ===\n');

  // List all tiger tables
  const tables = ['tiger_states', 'tiger_state', 'tiger_counties', 'tiger_county',
                  'tiger_cbsa', 'tiger_zcta', 'tiger_places', 'tiger_place'];

  for (const table of tables) {
    console.log(`\n--- ${table} ---`);
    const { data, error } = await supabase.from(table).select('*').limit(1);

    if (error) {
      if (error.message.includes('does not exist')) {
        console.log('  Table does not exist');
      } else {
        console.log('  Error:', error.message);
      }
    } else if (data && data.length > 0) {
      console.log('  Columns:', Object.keys(data[0]).join(', '));
      // Show sample values excluding geometry
      const sample: Record<string, any> = {};
      for (const [key, value] of Object.entries(data[0])) {
        if (key !== 'geometry' && key !== 'geom') {
          sample[key] = typeof value === 'string' && value.length > 50
            ? value.substring(0, 50) + '...'
            : value;
        }
      }
      console.log('  Sample:', JSON.stringify(sample, null, 2));
    } else {
      console.log('  Table exists but empty');
    }
  }
}

checkSchema().catch(console.error);
