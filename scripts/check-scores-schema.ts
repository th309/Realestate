/**
 * Quick check: What columns exist in propertyiq_scores?
 */

import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: 'packages/frontend/.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // Get one row to see structure
  const { data, error } = await supabase
    .from('propertyiq_scores')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('Sample row columns:');
    console.log(Object.keys(data[0]));
    console.log('\nSample data:');
    console.log(JSON.stringify(data[0], null, 2));
  } else {
    console.log('No data found');
  }
}

main().catch(console.error);
