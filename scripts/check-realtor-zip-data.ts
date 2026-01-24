import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  console.log('Checking realtor_zip table...\n');

  // Try to count
  const { count, error: countError } = await supabase
    .from('realtor_zip')
    .select('*', { count: 'exact', head: true });

  console.log('Count:', count, countError?.message);

  // Try to fetch some data
  const { data, error } = await supabase
    .from('realtor_zip')
    .select('postal_code, zip_name, median_listing_price, period_date')
    .limit(5);

  console.log('Error:', error?.message);
  console.log('Data:', data);

  // Check for FL ZIP
  const { data: flData } = await supabase
    .from('realtor_zip')
    .select('postal_code, zip_name, median_listing_price')
    .eq('postal_code', '33139')
    .limit(1);

  console.log('\n33139 ZIP:', flData);

  // Check any FL ZIP
  const { data: anyFL } = await supabase
    .from('realtor_zip')
    .select('postal_code, zip_name')
    .ilike('zip_name', '%FL%')
    .limit(5);

  console.log('\nFL ZIPs:', anyFL);
}

check().catch(console.error);
