/**
 * Check calculated_metrics table columns
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase
    .from('calculated_metrics')
    .select('*')
    .limit(1)
    .single();

  if (error) {
    console.log('Error:', error.message);
  } else {
    console.log('Columns in calculated_metrics:');
    Object.keys(data).forEach(col => console.log(`  - ${col}`));
    console.log('\nHas income_to_buy:', 'income_to_buy' in data);
  }
}

check().catch(console.error);
