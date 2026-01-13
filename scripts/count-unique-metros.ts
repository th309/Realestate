import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../packages/backend/.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function count() {
  // Use distinct query to get all unique region_ids
  const { data, error } = await supabase.rpc('get_unique_metro_region_ids');

  if (error) {
    console.log('RPC not available, using manual approach...');

    // Get in batches
    const allRegionIds = new Set<number>();
    let offset = 0;
    const batchSize = 50000;

    while (true) {
      const { data: batch } = await supabase
        .from('zillow_metro')
        .select('region_id')
        .range(offset, offset + batchSize - 1);

      if (!batch || batch.length === 0) break;

      batch.forEach(r => allRegionIds.add(r.region_id));
      offset += batchSize;

      if (batch.length < batchSize) break;

      process.stdout.write(`\rProcessed ${offset} rows, found ${allRegionIds.size} unique region_ids...`);
    }

    console.log(`\n\nTotal unique region_ids in zillow_metro: ${allRegionIds.size}`);
    console.log('\nAll region_ids:');
    [...allRegionIds].sort((a, b) => a - b).forEach(id => console.log(`  ${id}`));
    return;
  }

  console.log(`Unique region_ids: ${data?.length}`);
}

count();
