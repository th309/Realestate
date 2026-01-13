import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../packages/backend/.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  console.log('Checking zillow_zhvf table...');

  const { data, error } = await supabase
    .from('zillow_zhvf')
    .select('id')
    .limit(1);

  if (error) {
    console.log('Table does not exist or error:', error.message);
    console.log('\nYou need to run the migration first.');
    console.log('Run this SQL in Supabase Dashboard:\n');
    console.log('File: scripts/migrations/024-create-zillow-zhvf-table.sql');
  } else {
    console.log('Table exists!');
    console.log('Current rows:', data.length === 0 ? 'Empty' : data.length);
  }
}

check().catch(console.error);
