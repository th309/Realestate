/**
 * Check CBSA code status for all unique metros in zillow_metro table
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
  console.log('Checking CBSA code status for zillow_metro...\n');

  // Get sample of each unique region_id
  const { data } = await supabase
    .from('zillow_metro')
    .select('region_id, region_name, cbsa_code')
    .limit(50000);

  if (!data || data.length === 0) {
    console.log('No data found!');
    return;
  }

  // Deduplicate by region_id
  const unique = new Map<number, { region_id: number; region_name: string; cbsa_code: string | null }>();
  for (const r of data) {
    if (!unique.has(r.region_id)) {
      unique.set(r.region_id, r);
    }
  }

  const withCbsa: typeof data = [];
  const withoutCbsa: typeof data = [];

  for (const [id, r] of unique) {
    if (r.cbsa_code) {
      withCbsa.push(r);
    } else {
      withoutCbsa.push(r);
    }
  }

  console.log('='.repeat(80));
  console.log('WITH CBSA CODE:');
  console.log('='.repeat(80));
  withCbsa.forEach(r => console.log(`  ${r.region_id}: "${r.region_name}" -> ${r.cbsa_code}`));

  console.log('\n' + '='.repeat(80));
  console.log('WITHOUT CBSA CODE (NULL):');
  console.log('='.repeat(80));
  withoutCbsa.forEach(r => console.log(`  ${r.region_id}: "${r.region_name}"`));

  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY:');
  console.log('='.repeat(80));
  console.log(`  Total unique metros: ${unique.size}`);
  console.log(`  With CBSA code: ${withCbsa.length}`);
  console.log(`  Without CBSA code: ${withoutCbsa.length}`);
}

check().catch(console.error);
