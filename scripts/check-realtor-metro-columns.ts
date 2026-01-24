import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  console.log('Checking realtor_metro table structure...\n');

  // Get a sample row to see columns
  const { data: sample } = await supabase
    .from('realtor_metro')
    .select('*')
    .limit(1);

  if (sample && sample[0]) {
    console.log('Columns:', Object.keys(sample[0]).join(', '));
    console.log('\nSample row:');
    const { geometry, ...rest } = sample[0];
    console.log(rest);
  }

  // Check Chicago specifically
  console.log('\n=== Checking Chicago ===');

  // Try by cbsa_code (Chicago MSA is 16980)
  const { data: byCode, count: codeCount } = await supabase
    .from('realtor_metro')
    .select('cbsa_code, cbsa_title, median_listing_price, period_date', { count: 'exact' })
    .eq('cbsa_code', '16980')
    .order('period_date', { ascending: false })
    .limit(3);

  console.log('By cbsa_code=16980:', codeCount, 'rows');
  console.log('Sample:', byCode);

  // Try by cbsa_title
  const { data: byTitle, count: titleCount } = await supabase
    .from('realtor_metro')
    .select('cbsa_code, cbsa_title, median_listing_price, period_date', { count: 'exact' })
    .ilike('cbsa_title', '%Chicago%')
    .order('period_date', { ascending: false })
    .limit(3);

  console.log('\nBy cbsa_title ILIKE %Chicago%:', titleCount, 'rows');
  console.log('Sample:', byTitle);

  // Check what the frontend might be passing
  console.log('\n=== What frontend sends ===');
  const testQueries = ['Chicago, IL', 'Chicago', 'Chicago-Naperville-Elgin, IL-IN-WI'];
  for (const q of testQueries) {
    const { count } = await supabase
      .from('realtor_metro')
      .select('*', { count: 'exact', head: true })
      .eq('cbsa_code', q);
    console.log(`cbsa_code = '${q}':`, count);
  }
}

check().catch(console.error);
