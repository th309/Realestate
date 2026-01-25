/**
 * Verify that calculated_metrics has the same zip coverage as realtor_zip for income_to_buy.
 * For the latest realtor_zip period_date: count zips with median_listing_price and
 * count calculated_metrics zip rows with income_to_buy for that date. They should match.
 *
 * Run: npx tsx scripts/verify-income-to-buy-zip-coverage.ts
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Income-to-buy zip coverage: realtor_zip vs calculated_metrics\n');

  // Latest period_date in realtor_zip
  const { data: latestRealtor, error: e0 } = await supabase
    .from('realtor_zip')
    .select('period_date')
    .order('period_date', { ascending: false })
    .limit(1)
    .single();

  if (e0 || !latestRealtor?.period_date) {
    console.error('Could not get latest realtor_zip period_date:', e0?.message);
    process.exit(1);
  }

  const targetDate = latestRealtor.period_date;
  console.log(`Target date (from realtor_zip): ${targetDate}`);

  // Count distinct zips in realtor_zip for this date with listing price
  const { count: realtorCount, error: e1 } = await supabase
    .from('realtor_zip')
    .select('postal_code', { count: 'exact', head: true })
    .eq('period_date', targetDate)
    .not('median_listing_price', 'is', null);

  if (e1) {
    console.error('realtor_zip count error:', e1.message);
    process.exit(1);
  }

  // Count calculated_metrics zip rows with income_to_buy for this date
  const { count: calcCount, error: e2 } = await supabase
    .from('calculated_metrics')
    .select('geography_id', { count: 'exact', head: true })
    .eq('geography_type', 'zip')
    .eq('period_date', targetDate)
    .not('income_to_buy', 'is', null);

  if (e2) {
    console.error('calculated_metrics count error:', e2.message);
    process.exit(1);
  }

  const r = realtorCount ?? 0;
  const c = calcCount ?? 0;
  const match = r === c;

  console.log(`  realtor_zip (zips with median_listing_price): ${r}`);
  console.log(`  calculated_metrics (zip rows with income_to_buy): ${c}`);
  console.log(match ? '\n  OK — zip coverage matches.\n' : `\n  MISMATCH — run refresh so calculated_metrics has ${r} zip rows (currently ${c}).\n`);

  if (!match && c < r) {
    console.log('  To fix: npx tsx scripts/utils/refresh-calculated-metrics.ts (or your standard refresh workflow)\n');
  }

  process.exit(match ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
