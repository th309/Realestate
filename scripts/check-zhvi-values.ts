/**
 * Check exact values in zillow_zhvi for state data
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pysflbhpnqwoczyuaaif.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function check() {
  console.log('Checking distinct values in zillow_zhvi...\n');

  // Get sample with all fields
  const { data: sample } = await supabase
    .from('zillow_zhvi')
    .select('geography, property_type, tier')
    .limit(100);

  if (sample) {
    const geographies = [...new Set(sample.map(s => s.geography))];
    const propertyTypes = [...new Set(sample.map(s => s.property_type))];
    const tiers = [...new Set(sample.map(s => s.tier))];

    console.log('Distinct geography values:', geographies);
    console.log('Distinct property_type values:', propertyTypes);
    console.log('Distinct tier values:', tiers);
  }

  // Try with correct case
  console.log('\nTesting query with "State" (capital S)...');
  const { data, error, count } = await supabase
    .from('zillow_zhvi')
    .select('region_id, value, date', { count: 'exact' })
    .eq('geography', 'State')  // Capital S
    .limit(10);

  if (error) {
    console.log('Error:', error.message);
  } else {
    console.log(`Found ${count} records with geography="State"`);
    if (data) console.table(data.slice(0, 5));
  }

  // Check property types for State geography
  console.log('\nChecking property_type values for State geography...');
  const { data: stateData } = await supabase
    .from('zillow_zhvi')
    .select('property_type')
    .eq('geography', 'State')
    .limit(100);

  if (stateData) {
    const statePropertyTypes = [...new Set(stateData.map(s => s.property_type))];
    console.log('Property types for State:', statePropertyTypes);
  }
}

check();
