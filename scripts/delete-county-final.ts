/**
 * Delete remaining county data - simpler approach
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || (() => { throw new Error('SUPABASE_SERVICE_KEY is required'); })(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function deleteRemaining() {
  console.log('Deleting remaining county records...\n');

  // Try multiple small deletes
  for (let i = 0; i < 20; i++) {
    console.log(`Attempt ${i + 1}...`);

    const { error } = await supabase
      .from('zillow_zhvi')
      .delete()
      .eq('geography', 'County')
      .limit(100);

    if (error) {
      console.log('Error:', error.message);
    } else {
      console.log('Deleted batch');
    }

    // Small delay
    await new Promise(r => setTimeout(r, 1000));

    // Check count
    const { count } = await supabase
      .from('zillow_zhvi')
      .select('*', { count: 'exact', head: true })
      .eq('geography', 'County');

    console.log('Remaining:', count);
    if (count === 0) break;
  }
}

deleteRemaining();
