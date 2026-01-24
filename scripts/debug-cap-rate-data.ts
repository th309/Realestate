/**
 * Debug script to check cap_rate data
 * This will query the database directly and compare with expected values
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

const EXPENSE_RATIO = 0.6;

function calculateCapRate(rent: number, price: number): number | null {
  if (!rent || !price || price === 0) return null;
  return (rent * 12 * EXPENSE_RATIO) / price * 100;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('         CAP RATE DATA DIAGNOSTICS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 1. Check calculated_metrics table for cap_rate data
  console.log('📊 1. CHECKING calculated_metrics TABLE');
  console.log('───────────────────────────────────────────────────────────────');

  const { data: capRateCounts, error: countError } = await supabase.rpc('count_cap_rate_by_geo', {});

  // If RPC doesn't exist, do it manually
  const { data: metroCapRate, count: metroCount } = await supabase
    .from('calculated_metrics')
    .select('*', { count: 'exact', head: true })
    .eq('geography_type', 'metro')
    .not('cap_rate', 'is', null);

  const { count: countyCount } = await supabase
    .from('calculated_metrics')
    .select('*', { count: 'exact', head: true })
    .eq('geography_type', 'county')
    .not('cap_rate', 'is', null);

  const { count: zipCount } = await supabase
    .from('calculated_metrics')
    .select('*', { count: 'exact', head: true })
    .eq('geography_type', 'zip')
    .not('cap_rate', 'is', null);

  console.log(`  Metro cap_rate records: ${metroCount}`);
  console.log(`  County cap_rate records: ${countyCount}`);
  console.log(`  ZIP cap_rate records: ${zipCount}`);

  // 2. Sample Metro cap_rate data
  console.log('\n📊 2. SAMPLE METRO CAP RATE DATA');
  console.log('───────────────────────────────────────────────────────────────');

  const { data: metroSample } = await supabase
    .from('calculated_metrics')
    .select('geography_id, geography_name, cap_rate, gross_yield, grm, period_date')
    .eq('geography_type', 'metro')
    .not('cap_rate', 'is', null)
    .order('cap_rate', { ascending: false })
    .limit(10);

  if (metroSample && metroSample.length > 0) {
    console.log('\n  Top 10 metros by cap rate (highest):');
    for (const row of metroSample) {
      console.log(`    ${row.geography_name} (${row.geography_id}): ${row.cap_rate}%`);
    }
  } else {
    console.log('  ❌ No metro cap rate data found!');
  }

  // 3. Sample County cap_rate data
  console.log('\n📊 3. SAMPLE COUNTY CAP RATE DATA');
  console.log('───────────────────────────────────────────────────────────────');

  const { data: countySample } = await supabase
    .from('calculated_metrics')
    .select('geography_id, geography_name, cap_rate, period_date')
    .eq('geography_type', 'county')
    .not('cap_rate', 'is', null)
    .order('cap_rate', { ascending: false })
    .limit(10);

  if (countySample && countySample.length > 0) {
    console.log('\n  Top 10 counties by cap rate:');
    for (const row of countySample) {
      console.log(`    ${row.geography_name} (${row.geography_id}): ${row.cap_rate}%`);
    }
  } else {
    console.log('  ❌ No county cap rate data found!');
  }

  // 4. Sample ZIP cap_rate data
  console.log('\n📊 4. SAMPLE ZIP CAP RATE DATA');
  console.log('───────────────────────────────────────────────────────────────');

  const { data: zipSample } = await supabase
    .from('calculated_metrics')
    .select('geography_id, geography_name, cap_rate, period_date')
    .eq('geography_type', 'zip')
    .not('cap_rate', 'is', null)
    .order('cap_rate', { ascending: false })
    .limit(10);

  if (zipSample && zipSample.length > 0) {
    console.log('\n  Top 10 ZIPs by cap rate:');
    for (const row of zipSample) {
      console.log(`    ${row.geography_name} (${row.geography_id}): ${row.cap_rate}%`);
    }
  } else {
    console.log('  ❌ No ZIP cap rate data found!');
  }

  // 5. Verify calculation by checking source data
  console.log('\n📊 5. VERIFY CALCULATION (METRO SAMPLE)');
  console.log('───────────────────────────────────────────────────────────────');

  if (metroSample && metroSample.length > 0) {
    const testCbsa = metroSample[0].geography_id;
    const testName = metroSample[0].geography_name;
    const storedCapRate = metroSample[0].cap_rate;

    console.log(`\n  Testing: ${testName} (${testCbsa})`);
    console.log(`  Stored cap_rate: ${storedCapRate}%`);

    // Get ZORI data
    const { data: zoriData } = await supabase
      .from('zillow_metro')
      .select('value, period_date')
      .eq('cbsa_code', testCbsa)
      .eq('metric_name', 'zori')
      .order('period_date', { ascending: false })
      .limit(1)
      .single();

    // Get Realtor price data
    const { data: priceData } = await supabase
      .from('realtor_metro')
      .select('median_listing_price, period_date')
      .eq('cbsa_code', testCbsa)
      .order('period_date', { ascending: false })
      .limit(1)
      .single();

    if (zoriData && priceData) {
      console.log(`  ZORI (rent): $${zoriData.value}/month (${zoriData.period_date})`);
      console.log(`  Realtor price: $${priceData.median_listing_price} (${priceData.period_date})`);

      const expectedCapRate = calculateCapRate(zoriData.value, priceData.median_listing_price);
      console.log(`  Expected cap_rate: ${expectedCapRate?.toFixed(2)}%`);
      console.log(`  Formula: (${zoriData.value} × 12 × 0.6) / ${priceData.median_listing_price} × 100`);

      if (expectedCapRate && Math.abs(storedCapRate - expectedCapRate) > 0.1) {
        console.log(`  ⚠️ MISMATCH: Stored=${storedCapRate}, Expected=${expectedCapRate.toFixed(2)}`);
      } else {
        console.log(`  ✓ Calculation matches!`);
      }
    } else {
      console.log('  Could not fetch source data for verification');
      console.log(`    ZORI: ${zoriData ? 'found' : 'NOT FOUND'}`);
      console.log(`    Price: ${priceData ? 'found' : 'NOT FOUND'}`);
    }
  }

  // 6. Check for unreasonable values
  console.log('\n📊 6. CHECK FOR UNREASONABLE VALUES');
  console.log('───────────────────────────────────────────────────────────────');

  const { data: extremeHigh } = await supabase
    .from('calculated_metrics')
    .select('geography_id, geography_name, geography_type, cap_rate')
    .not('cap_rate', 'is', null)
    .gt('cap_rate', 20)  // Cap rates above 20% are suspicious
    .limit(10);

  const { data: extremeLow } = await supabase
    .from('calculated_metrics')
    .select('geography_id, geography_name, geography_type, cap_rate')
    .not('cap_rate', 'is', null)
    .lt('cap_rate', 1)  // Cap rates below 1% are suspicious
    .limit(10);

  if (extremeHigh && extremeHigh.length > 0) {
    console.log(`\n  ⚠️ Found ${extremeHigh.length} records with cap_rate > 20%:`);
    for (const row of extremeHigh.slice(0, 5)) {
      console.log(`    ${row.geography_type}: ${row.geography_name} = ${row.cap_rate}%`);
    }
  }

  if (extremeLow && extremeLow.length > 0) {
    console.log(`\n  Found ${extremeLow.length} records with cap_rate < 1%:`);
    for (const row of extremeLow.slice(0, 5)) {
      console.log(`    ${row.geography_type}: ${row.geography_name} = ${row.cap_rate}%`);
    }
  }

  // 7. Compare with income_to_buy (which works)
  console.log('\n📊 7. COMPARE WITH INCOME_TO_BUY (REFERENCE)');
  console.log('───────────────────────────────────────────────────────────────');

  const { count: incomeToBuyMetro } = await supabase
    .from('calculated_metrics')
    .select('*', { count: 'exact', head: true })
    .eq('geography_type', 'metro')
    .not('income_to_buy', 'is', null);

  const { count: incomeToBuyCounty } = await supabase
    .from('calculated_metrics')
    .select('*', { count: 'exact', head: true })
    .eq('geography_type', 'county')
    .not('income_to_buy', 'is', null);

  const { count: incomeToBuyZip } = await supabase
    .from('calculated_metrics')
    .select('*', { count: 'exact', head: true })
    .eq('geography_type', 'zip')
    .not('income_to_buy', 'is', null);

  console.log(`  income_to_buy records:`);
  console.log(`    Metro: ${incomeToBuyMetro}`);
  console.log(`    County: ${incomeToBuyCounty}`);
  console.log(`    ZIP: ${incomeToBuyZip}`);

  // 8. Check period_date alignment
  console.log('\n📊 8. CHECK PERIOD DATES');
  console.log('───────────────────────────────────────────────────────────────');

  const { data: capRateDates } = await supabase
    .from('calculated_metrics')
    .select('period_date')
    .not('cap_rate', 'is', null)
    .order('period_date', { ascending: false });

  const uniqueDates = [...new Set((capRateDates || []).map(r => r.period_date))];
  console.log(`  Unique period_dates for cap_rate: ${uniqueDates.slice(0, 5).join(', ')}`);

  const { data: incomeDates } = await supabase
    .from('calculated_metrics')
    .select('period_date')
    .not('income_to_buy', 'is', null)
    .order('period_date', { ascending: false });

  const uniqueIncomeDates = [...new Set((incomeDates || []).map(r => r.period_date))];
  console.log(`  Unique period_dates for income_to_buy: ${uniqueIncomeDates.slice(0, 5).join(', ')}`);

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('         DIAGNOSTICS COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
