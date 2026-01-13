import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../packages/backend/.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function test() {
  console.log('Testing basic Metro queries...\n');

  // Test 1: Simple select with limit
  console.log('Test 1: Simple select');
  const { data: data1, error: error1 } = await supabase
    .from('zillow_zhvi')
    .select('id, region_id, date')
    .eq('geography', 'Metro')
    .limit(3);
  console.log('Data:', data1);
  console.log('Error:', error1);

  // Test 2: Count only (head: true)
  console.log('\nTest 2: Count with head:true');
  const { count: count2, error: error2 } = await supabase
    .from('zillow_zhvi')
    .select('id', { count: 'exact', head: true })
    .eq('geography', 'Metro');
  console.log('Count:', count2);
  console.log('Error:', error2);

  // Test 3: Count without head
  console.log('\nTest 3: Count without head');
  const { count: count3, error: error3 } = await supabase
    .from('zillow_zhvi')
    .select('id', { count: 'exact' })
    .eq('geography', 'Metro')
    .limit(1);
  console.log('Count:', count3);
  console.log('Error:', error3);
}

test().catch(console.error);
