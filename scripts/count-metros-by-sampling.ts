/**
 * Count unique metros by sampling across the table
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../packages/backend/.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function countByRegionIdRange() {
  console.log('Counting unique metros by region_id ranges...\n');

  // Zillow region IDs for metros are typically in the 394xxx-396xxx and 753xxx-800xxx ranges
  const ranges = [
    { min: 390000, max: 395000 },
    { min: 395000, max: 400000 },
    { min: 400000, max: 500000 },
    { min: 500000, max: 600000 },
    { min: 600000, max: 700000 },
    { min: 700000, max: 800000 },
    { min: 800000, max: 900000 },
  ];

  let totalUniqueMetros = 0;
  const allRegionIds = new Set<number>();

  for (const range of ranges) {
    const { count } = await supabase
      .from('zillow_metro')
      .select('*', { count: 'exact', head: true })
      .gte('region_id', range.min)
      .lt('region_id', range.max);

    if (count && count > 0) {
      // Get sample of region_ids in this range
      const { data: sample } = await supabase
        .from('zillow_metro')
        .select('region_id')
        .gte('region_id', range.min)
        .lt('region_id', range.max)
        .limit(1000);

      const uniqueInSample = new Set(sample?.map(r => r.region_id) || []);
      uniqueInSample.forEach(id => allRegionIds.add(id));

      console.log(`Range ${range.min}-${range.max}: ${count.toLocaleString()} rows, ${uniqueInSample.size} unique in sample`);
    }
  }

  console.log(`\nTotal unique region_ids found in samples: ${allRegionIds.size}`);

  // Now let's get a more accurate count by querying specific known metros
  // Sample at different offsets to find more unique values
  console.log('\nSampling at different offsets...');

  const offsets = [0, 100000, 500000, 1000000, 2000000, 3000000, 4000000, 5000000, 6000000];

  for (const offset of offsets) {
    const { data: sample } = await supabase
      .from('zillow_metro')
      .select('region_id, region_name')
      .range(offset, offset + 999)
      .limit(1000);

    if (sample && sample.length > 0) {
      sample.forEach(r => allRegionIds.add(r.region_id));
      const uniqueNames = new Set(sample.map(r => r.region_name));
      console.log(`  Offset ${offset.toLocaleString()}: sample metro = "${sample[0].region_name}" (${sample[0].region_id})`);
    }
  }

  console.log(`\nTotal unique region_ids found: ${allRegionIds.size}`);

  // Print all found region_ids
  const sortedIds = [...allRegionIds].sort((a, b) => a - b);
  console.log('\nAll unique region_ids:');
  sortedIds.forEach(id => console.log(`  ${id}`));
}

countByRegionIdRange().catch(console.error);
