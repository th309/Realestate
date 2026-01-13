import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../packages/backend/.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  console.log('Checking zillow_zordi table...');

  const { data, error } = await supabase
    .from('zillow_zordi')
    .select('id, region_id, value, geography')
    .limit(5);

  if (error) {
    console.log('Error:', error.message);
    console.log('\nTable does not exist. You need to run the migration.');
    console.log('Run this SQL in Supabase Dashboard:');
    console.log('File: scripts/migrations/025-create-zillow-zordi-table.sql');
  } else {
    console.log('Table exists!');
    console.log('Sample rows:', JSON.stringify(data, null, 2));

    const { count } = await supabase.from('zillow_zordi').select('*', { count: 'exact', head: true });
    console.log('Total rows:', count);
  }
}

check().catch(console.error);
