/**
 * Verify Income-to-Buy historical data
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function verify() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('         INCOME-TO-BUY HISTORICAL DATA VERIFICATION');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Total count by geography type
  console.log('TOTAL RECORDS BY GEOGRAPHY TYPE:\n');
  let grandTotal = 0;

  for (const geo of ['national', 'state', 'metro', 'county', 'zip']) {
    const { count } = await supabase
      .from('calculated_metrics')
      .select('*', { count: 'exact', head: true })
      .eq('geography_type', geo)
      .not('income_to_buy', 'is', null);

    console.log(`  ${geo.padEnd(10)}: ${String(count || 0).padStart(10)} records`);
    grandTotal += count || 0;
  }

  console.log(`  ${'─'.repeat(25)}`);
  console.log(`  ${'TOTAL'.padEnd(10)}: ${String(grandTotal).padStart(10)} records\n`);

  // Distinct months by geography type
  console.log('MONTHS OF HISTORICAL DATA:\n');

  for (const geo of ['national', 'state', 'metro', 'county', 'zip']) {
    const { data } = await supabase
      .from('calculated_metrics')
      .select('period_date')
      .eq('geography_type', geo)
      .not('income_to_buy', 'is', null);

    const uniqueDates = [...new Set((data || []).map(r => r.period_date))].sort();
    const earliest = uniqueDates[0] || 'N/A';
    const latest = uniqueDates[uniqueDates.length - 1] || 'N/A';

    console.log(`  ${geo.padEnd(10)}: ${uniqueDates.length} months (${earliest} to ${latest})`);
  }

  // Sample historical trend for national
  console.log('\n───────────────────────────────────────────────────────────────');
  console.log('SAMPLE: NATIONAL INCOME-TO-BUY TREND (Last 12 Months)');
  console.log('───────────────────────────────────────────────────────────────\n');

  const { data: nationalTrend } = await supabase
    .from('calculated_metrics')
    .select('period_date, income_to_buy')
    .eq('geography_type', 'national')
    .not('income_to_buy', 'is', null)
    .order('period_date', { ascending: false })
    .limit(12);

  for (const row of (nationalTrend || []).reverse()) {
    const income = row.income_to_buy?.toLocaleString() || 'N/A';
    console.log(`  ${row.period_date}: $${income}/year`);
  }

  // Sample state historical trend
  console.log('\n───────────────────────────────────────────────────────────────');
  console.log('SAMPLE: CALIFORNIA INCOME-TO-BUY TREND (Last 12 Months)');
  console.log('───────────────────────────────────────────────────────────────\n');

  const { data: caTrend } = await supabase
    .from('calculated_metrics')
    .select('period_date, income_to_buy')
    .eq('geography_type', 'state')
    .eq('geography_name', 'California')
    .not('income_to_buy', 'is', null)
    .order('period_date', { ascending: false })
    .limit(12);

  for (const row of (caTrend || []).reverse()) {
    const income = row.income_to_buy?.toLocaleString() || 'N/A';
    console.log(`  ${row.period_date}: $${income}/year`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
}

verify().catch(console.error);
