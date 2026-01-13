/**
 * Full check of zillow_metro table - get all unique region_ids
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../packages/backend/.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  console.log('Full check of zillow_metro table...\n');

  // Count total rows
  const { count: total } = await supabase
    .from('zillow_metro')
    .select('*', { count: 'exact', head: true });

  console.log(`Total rows: ${total?.toLocaleString()}`);

  // Get ALL unique region_ids by paginating through the entire table
  const allRegionIds = new Set<number>();
  const metricCounts = new Map<string, number>();
  const cbsaStatus = { withCbsa: 0, withoutCbsa: 0 };
  let offset = 0;
  const batchSize = 50000;
  let totalProcessed = 0;

  console.log('\nScanning all records...');

  // Use smaller batches with explicit limit to work around Supabase limits
  const effectiveBatchSize = 10000;

  while (totalProcessed < (total || 0)) {
    const { data: batch, error } = await supabase
      .from('zillow_metro')
      .select('region_id, metric_name, cbsa_code')
      .range(offset, offset + effectiveBatchSize - 1)
      .limit(effectiveBatchSize);

    if (error) {
      console.error('Error:', error.message);
      break;
    }

    if (!batch || batch.length === 0) break;

    for (const r of batch) {
      allRegionIds.add(r.region_id);
      metricCounts.set(r.metric_name, (metricCounts.get(r.metric_name) || 0) + 1);
      if (r.cbsa_code) {
        cbsaStatus.withCbsa++;
      } else {
        cbsaStatus.withoutCbsa++;
      }
    }

    totalProcessed += batch.length;
    offset += batch.length;

    if (totalProcessed % 100000 === 0 || batch.length < effectiveBatchSize) {
      process.stdout.write(`\r  Processed ${totalProcessed.toLocaleString()} / ${total?.toLocaleString()} rows, found ${allRegionIds.size} unique region_ids...`);
    }

    if (batch.length < effectiveBatchSize) break;
  }

  console.log(`\n\nTotal processed: ${totalProcessed.toLocaleString()}`);
  console.log(`Unique region_ids: ${allRegionIds.size}`);

  console.log('\nMetrics in table:');
  const sortedMetrics = [...metricCounts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [name, count] of sortedMetrics) {
    console.log(`  ${name}: ${count.toLocaleString()}`);
  }

  console.log('\nCBSA code status:');
  console.log(`  With CBSA code: ${cbsaStatus.withCbsa.toLocaleString()}`);
  console.log(`  Without CBSA code (NULL): ${cbsaStatus.withoutCbsa.toLocaleString()}`);
}

check().catch(console.error);
