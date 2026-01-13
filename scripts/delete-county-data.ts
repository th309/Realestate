/**
 * Delete all county data from zillow_zhvi table
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I',
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
