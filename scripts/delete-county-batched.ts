/**
 * Delete county data in batches to avoid timeout
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function deleteInBatches() {
  console.log('Deleting county data in batches...\n');

  let totalDeleted = 0;
  let batchNum = 0;

  while (true) {
    batchNum++;

    // Small delay between batches
    if (batchNum > 1) {
      await new Promise(r => setTimeout(r, 500));
    }

    // Get IDs to delete
    const { data: records, error: selectError } = await supabase
      .from('zillow_zhvi')
      .select('id')
      .eq('geography', 'County')
      .limit(500);

    if (selectError) {
      console.error('Select error:', selectError);
      break;
    }

    if (!records || records.length === 0) {
      console.log('\nNo more records to delete.');
      break;
    }

    const ids = records.map(r => r.id);

    // Delete by IDs
    const { error: deleteError } = await supabase
      .from('zillow_zhvi')
      .delete()
      .in('id', ids);

    if (deleteError) {
      console.error('Delete error:', deleteError);
      break;
    }

    totalDeleted += ids.length;
    process.stdout.write(`\rBatch ${batchNum}: Deleted ${totalDeleted.toLocaleString()} records`);
  }

  console.log(`\n\nTotal deleted: ${totalDeleted.toLocaleString()}`);

  // Verify
  const { count } = await supabase
    .from('zillow_zhvi')
    .select('*', { count: 'exact', head: true })
    .eq('geography', 'County');

  console.log('Remaining county records:', count);
}

deleteInBatches();
