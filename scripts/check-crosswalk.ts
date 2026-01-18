import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pysflbhpnqwoczyuaaif.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  // Try different table names
  const tables = ['cbsa_metro_crosswalk', 'metro_crosswalk', 'zillow_metro_crosswalk', 'crosswalk'];
  
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (!error) {
      console.log(`Found table: ${table}`);
      console.log('Sample row:', JSON.stringify(data?.[0], null, 2));
      return;
    }
  }
  
  // Check how the existing import does it
  console.log('\nChecking zillow_metro for region mappings...');
  const { data } = await supabase
    .from('zillow_metro')
    .select('region_id, region_name, cbsa_code')
    .eq('metric_name', 'zori')
    .limit(5);
  
  console.log('Existing zillow_metro ZORI records:');
  data?.forEach(r => console.log(`  ${r.region_id}: ${r.region_name} -> ${r.cbsa_code}`));
}

check().catch(console.error);
