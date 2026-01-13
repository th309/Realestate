/**
 * Clear all data from zillow_metro table
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../packages/backend/.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function clearTable() {
  console.log('Clearing zillow_metro table in batches by region_id...');

  let totalDeleted = 0;
  let iteration = 0;

  while (true) {
    iteration++;

    // Get unique region_ids from current sample
    const { data: regions } = await supabase
      .from('zillow_metro')
      .select('region_id')
      .limit(50000);

    if (!regions || regions.length === 0) {
      console.log('No more records found');
      break;
    }

    const uniqueRegionIds = [...new Set(regions.map(r => r.region_id))];
    console.log(`\nIteration ${iteration}: Found ${uniqueRegionIds.length} unique region_ids`);

    for (const regionId of uniqueRegionIds) {
      const { error, count } = await supabase
        .from('zillow_metro')
        .delete({ count: 'exact' })
        .eq('region_id', regionId);

      if (error) {
        console.log(`Error deleting region ${regionId}:`, error.message);
        continue;
      }

      totalDeleted += count || 0;
      process.stdout.write(`\rDeleted: ${totalDeleted.toLocaleString()} records`);
    }
  }

  // Verify
  const { count } = await supabase
    .from('zillow_metro')
    .select('*', { count: 'exact', head: true });

  console.log(`\n\nDone! Total deleted: ${totalDeleted.toLocaleString()}`);
  console.log(`Remaining records: ${count}`);
}

clearTable().catch(console.error);
