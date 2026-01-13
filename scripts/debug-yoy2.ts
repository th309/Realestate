import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../packages/backend/.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function debug() {
  // Try with explicit error checking
  console.log('Checking County NULL yoy_growth with error handling...\n');

  const result = await supabase
    .from('zillow_zhvi')
    .select('*', { count: 'exact', head: true })
    .eq('geography', 'County')
    .is('yoy_growth', null);

  console.log('Full result:', JSON.stringify(result, null, 2));
  console.log('Count:', result.count);
  console.log('Error:', result.error);

  // Try filtering differently - get some records and count manually
  console.log('\nFetching sample to check manually...');
  const { data: sample, count: sampleCount } = await supabase
    .from('zillow_zhvi')
    .select('id, yoy_growth', { count: 'exact' })
    .eq('geography', 'County')
    .is('yoy_growth', null)
    .limit(10);

  console.log('Sample count:', sampleCount);
  console.log('Sample data:', sample?.slice(0, 3));

  // Check what property_type and tier values exist
  console.log('\nChecking unique property_type/tier combinations for County...');
  const { data: combos } = await supabase
    .from('zillow_zhvi')
    .select('property_type, tier')
    .eq('geography', 'County')
    .limit(1);
  console.log('Sample combo:', combos);
}

debug().catch(console.error);
