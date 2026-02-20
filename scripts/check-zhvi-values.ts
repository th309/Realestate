/**
 * Check exact values in zillow_zhvi for state data
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pysflbhpnqwoczyuaaif.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || (() => { throw new Error('SUPABASE_SERVICE_KEY is required'); })();

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
