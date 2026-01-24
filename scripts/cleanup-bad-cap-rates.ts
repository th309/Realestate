/**
 * Cleanup script to remove bad cap_rate data before repopulating
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('         CLEANING UP BAD CAP RATE DATA');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Count records before cleanup
  const { count: before } = await supabase
    .from('calculated_metrics')
    .select('*', { count: 'exact', head: true })
    .not('cap_rate', 'is', null);

  console.log(`  Total cap_rate records before cleanup: ${before}`);

  // Set cap_rate to null for extreme values (> 20% or < 0.5% or negative)
  console.log('\n  Clearing invalid cap_rate values...');

  // Clear cap rates > 20%
  const { data: highData, error: highError } = await supabase
    .from('calculated_metrics')
    .update({
      cap_rate: null,
      gross_yield: null,
      rent_to_price_ratio: null,
      grm: null
    })
    .gt('cap_rate', 20)
    .select('geography_id');

  if (highError) {
    console.log(`    Error clearing high cap rates: ${highError.message}`);
  } else {
    console.log(`    Cleared ${highData?.length || 0} records with cap_rate > 20%`);
  }

  // Clear cap rates < 0.5%
  const { data: lowData, error: lowError } = await supabase
    .from('calculated_metrics')
    .update({
      cap_rate: null,
      gross_yield: null,
      rent_to_price_ratio: null,
      grm: null
    })
    .lt('cap_rate', 0.5)
    .select('geography_id');

  if (lowError) {
    console.log(`    Error clearing low cap rates: ${lowError.message}`);
  } else {
    console.log(`    Cleared ${lowData?.length || 0} records with cap_rate < 0.5%`);
  }

  // Count records after cleanup
  const { count: after } = await supabase
    .from('calculated_metrics')
    .select('*', { count: 'exact', head: true })
    .not('cap_rate', 'is', null);

  console.log(`\n  Total cap_rate records after cleanup: ${after}`);
  console.log(`  Removed ${(before || 0) - (after || 0)} invalid records`);

  // Verify remaining values are in valid range
  const { data: sampleData } = await supabase
    .from('calculated_metrics')
    .select('geography_name, geography_type, cap_rate')
    .not('cap_rate', 'is', null)
    .order('cap_rate', { ascending: false })
    .limit(10);

  console.log('\n  Sample remaining cap rates (highest):');
  for (const row of sampleData || []) {
    console.log(`    ${row.geography_type}: ${row.geography_name} = ${row.cap_rate}%`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('         CLEANUP COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
