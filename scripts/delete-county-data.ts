/**
 * Delete all county data from zillow_zhvi table
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || (() => { throw new Error('SUPABASE_SERVICE_KEY is required'); })(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function deleteCountyData() {
  console.log('Getting count of county records...');

  const { count: beforeCount } = await supabase
    .from('zillow_zhvi')
    .select('*', { count: 'exact', head: true })
    .eq('geography', 'County');

  console.log('Records before delete:', beforeCount);

  console.log('\nDeleting county data (this may take a while)...');

  // Delete without returning rows (faster)
  const { error } = await supabase
    .from('zillow_zhvi')
    .delete()
    .eq('geography', 'County');

  if (error) {
    console.error('Delete error:', error);
  } else {
    console.log('Delete completed successfully');
  }

  // Check remaining
  const { count: afterCount } = await supabase
    .from('zillow_zhvi')
    .select('*', { count: 'exact', head: true })
    .eq('geography', 'County');

  console.log('Records after delete:', afterCount);
}

deleteCountyData();
