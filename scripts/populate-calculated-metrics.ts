/**
 * Populate Calculated Metrics
 *
 * This script calculates and stores all calculated metrics:
 * - Investment metrics (cap_rate, gross_yield, rent_to_price, grm)
 * - Overvalued percentage
 * - 5-year home value growth
 * - Inventory surplus
 *
 * Usage: npx ts-node scripts/populate-calculated-metrics.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Try multiple env file locations
dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  console.error('Tried: SUPABASE_URL, NEXT_PUBLIC_SUPABASE_URL');
  console.error('Tried: SUPABASE_SERVICE_KEY, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Constants
const EXPENSE_RATIO = 0.6;
const PRICE_TO_INCOME_BENCHMARK = 3.5;
const NATIONAL_MEDIAN_INCOME = 75000;
const BATCH_SIZE = 100;

// ============================================================================
// CALCULATION FUNCTIONS
// ============================================================================

function calculateCapRate(zori: number, price: number): number | null {
  if (!zori || !price || price === 0) return null;
  return (zori * 12 * EXPENSE_RATIO) / price * 100;
}

function calculateGrossYield(zori: number, price: number): number | null {
  if (!zori || !price || price === 0) return null;
  return (zori * 12) / price * 100;
}

function calculateRentToPriceRatio(zori: number, price: number): number | null {
  if (!zori || !price || price === 0) return null;
  return zori / price;
}

function calculateGRM(price: number, zori: number): number | null {
  if (!price || !zori || zori === 0) return null;
  return price / (zori * 12);
}

function calculateOvervalued(price: number, income: number): number | null {
  if (!price || !income || income === 0) return null;
  const priceToIncome = price / income;
  return ((priceToIncome - PRICE_TO_INCOME_BENCHMARK) / PRICE_TO_INCOME_BENCHMARK) * 100;
}

// ============================================================================
// INVESTMENT METRICS CALCULATION
// ============================================================================

async function calculateInvestmentMetricsForMetros(): Promise<{ processed: number; stored: number; errors: string[] }> {
  console.log('\n📊 Calculating investment metrics for metros...');
  const errors: string[] = [];

  // Get latest ZORI date from zillow_metro table (long format)
  const { data: zoriDateRow } = await supabase
    .from('zillow_metro')
    .select('period_date')
    .eq('metric_name', 'zori')
    .order('period_date', { ascending: false })
    .limit(1)
    .single();

  if (!zoriDateRow?.period_date) {
    return { processed: 0, stored: 0, errors: ['No ZORI data available'] };
  }

  const targetDate = zoriDateRow.period_date;
  console.log(`  Target date: ${targetDate}`);

  // Get ZORI (rent) data for all metros from zillow_metro table
  const { data: zoriData, error: zoriError } = await supabase
    .from('zillow_metro')
    .select('region_id, region_name, value, cbsa_code')
    .eq('metric_name', 'zori')
    .eq('period_date', targetDate)
    .not('value', 'is', null);

  if (zoriError || !zoriData) {
    return { processed: 0, stored: 0, errors: [zoriError?.message || 'Failed to fetch ZORI data'] };
  }

  console.log(`  Found ${zoriData.length} metros with ZORI data`);

  // Get Realtor listing price data
  const { data: realtorDateRow } = await supabase
    .from('realtor_metro')
    .select('period_date')
    .order('period_date', { ascending: false })
    .limit(1)
    .single();

  const realtorDate = realtorDateRow?.period_date || targetDate;
  console.log(`  Realtor date: ${realtorDate}`);

  const { data: realtorData } = await supabase
    .from('realtor_metro')
    .select('cbsa_code, median_listing_price')
    .eq('period_date', realtorDate)
    .not('median_listing_price', 'is', null);

  // Build price lookup by CBSA code
  const priceByCode: Record<string, number> = {};
  if (realtorData) {
    for (const row of realtorData) {
      if (row.cbsa_code && row.median_listing_price) {
        priceByCode[row.cbsa_code] = row.median_listing_price;
      }
    }
  }
  console.log(`  Found ${Object.keys(priceByCode).length} metros with price data`);

  // Calculate and batch upsert
  let stored = 0;
  const recordsToUpsert: any[] = [];

  for (const metro of zoriData) {
    const cbsaCode = metro.cbsa_code;
    const zori = metro.value;
    const price = cbsaCode ? priceByCode[cbsaCode] : null;

    if (!zori || !price) continue;

    const capRate = calculateCapRate(zori, price);
    const grossYield = calculateGrossYield(zori, price);
    const rentToPriceRatio = calculateRentToPriceRatio(zori, price);
    const grm = calculateGRM(price, zori);

    recordsToUpsert.push({
      geography_id: cbsaCode,
      geography_type: 'metro',
      geography_name: metro.region_name,
      period_date: targetDate,
      cap_rate: capRate ? Math.round(capRate * 100) / 100 : null,
      gross_yield: grossYield ? Math.round(grossYield * 100) / 100 : null,
      rent_to_price_ratio: rentToPriceRatio ? Math.round(rentToPriceRatio * 10000) / 10000 : null,
      grm: grm ? Math.round(grm * 100) / 100 : null,
      calculated_at: new Date().toISOString(),
    });

    if (recordsToUpsert.length >= BATCH_SIZE) {
      const { error } = await supabase
        .from('calculated_metrics')
        .upsert(recordsToUpsert, { onConflict: 'geography_id,geography_type,period_date' });
      if (error) {
        errors.push(error.message);
      } else {
        stored += recordsToUpsert.length;
      }
      recordsToUpsert.length = 0;
    }
  }

  // Upsert remaining
  if (recordsToUpsert.length > 0) {
    const { error } = await supabase
      .from('calculated_metrics')
      .upsert(recordsToUpsert, { onConflict: 'geography_id,geography_type,period_date' });
    if (error) {
      errors.push(error.message);
    } else {
      stored += recordsToUpsert.length;
    }
  }

  console.log(`  ✓ Stored ${stored} investment metrics records`);
  return { processed: zoriData.length, stored, errors };
}

// ============================================================================
// OVERVALUED PERCENTAGE CALCULATION
// ============================================================================

async function calculateOvervaluedForMetros(): Promise<{ processed: number; stored: number; errors: string[] }> {
  console.log('\n📊 Calculating overvalued percentage for metros...');
  const errors: string[] = [];

  // Get latest ZHVI date from zillow_metro table (long format)
  const { data: zhviDateRow } = await supabase
    .from('zillow_metro')
    .select('period_date')
    .eq('metric_name', 'zhvi')
    .order('period_date', { ascending: false })
    .limit(1)
    .single();

  if (!zhviDateRow?.period_date) {
    return { processed: 0, stored: 0, errors: ['No ZHVI data available'] };
  }

  const targetDate = zhviDateRow.period_date;
  console.log(`  Target date: ${targetDate}`);

  // Get ZHVI data for all metros from zillow_metro table
  const { data: zhviData, error: zhviError } = await supabase
    .from('zillow_metro')
    .select('region_id, region_name, value, cbsa_code')
    .eq('metric_name', 'zhvi')
    .eq('period_date', targetDate)
    .not('value', 'is', null);

  if (zhviError || !zhviData) {
    return { processed: 0, stored: 0, errors: [zhviError?.message || 'Failed to fetch ZHVI data'] };
  }

  console.log(`  Found ${zhviData.length} metros with ZHVI data`);

  // Get Census median income data
  const { data: incomeData } = await supabase
    .from('census_data')
    .select('geography_id, value')
    .eq('geography_type', 'metro')
    .eq('metric_name', 'median_income')
    .order('year', { ascending: false });

  // Build income lookup
  const incomeByGeo: Record<string, number> = {};
  if (incomeData) {
    for (const row of incomeData) {
      if (row.value && !incomeByGeo[row.geography_id]) {
        incomeByGeo[row.geography_id] = Number(row.value);
      }
    }
  }
  console.log(`  Found ${Object.keys(incomeByGeo).length} metros with income data`);

  // Calculate and batch upsert
  let stored = 0;
  const recordsToUpsert: any[] = [];

  for (const metro of zhviData) {
    const cbsaCode = metro.cbsa_code;
    const zhvi = metro.value;
    const medianIncome = (cbsaCode && incomeByGeo[cbsaCode]) || NATIONAL_MEDIAN_INCOME;

    const overvaluedPct = calculateOvervalued(zhvi, medianIncome);

    if (overvaluedPct === null) continue;

    recordsToUpsert.push({
      geography_id: cbsaCode,
      geography_type: 'metro',
      geography_name: metro.region_name,
      period_date: targetDate,
      overvalued_pct: Math.round(overvaluedPct * 10) / 10,
      calculated_at: new Date().toISOString(),
    });

    if (recordsToUpsert.length >= BATCH_SIZE) {
      const { error } = await supabase
        .from('calculated_metrics')
        .upsert(recordsToUpsert, { onConflict: 'geography_id,geography_type,period_date' });
      if (error) {
        errors.push(error.message);
      } else {
        stored += recordsToUpsert.length;
      }
      recordsToUpsert.length = 0;
    }
  }

  // Upsert remaining
  if (recordsToUpsert.length > 0) {
    const { error } = await supabase
      .from('calculated_metrics')
      .upsert(recordsToUpsert, { onConflict: 'geography_id,geography_type,period_date' });
    if (error) {
      errors.push(error.message);
    } else {
      stored += recordsToUpsert.length;
    }
  }

  console.log(`  ✓ Stored ${stored} overvalued percentage records`);
  return { processed: zhviData.length, stored, errors };
}

// ============================================================================
// 5-YEAR GROWTH CALCULATION
// ============================================================================

async function calculate5YrGrowthForMetros(): Promise<{ processed: number; stored: number }> {
  console.log('\n📊 Calculating 5-year growth for metros...');

  // Get latest date
  const { data: latestDateRow } = await supabase
    .from('realtor_metro')
    .select('period_date')
    .order('period_date', { ascending: false })
    .limit(1)
    .single();

  if (!latestDateRow?.period_date) {
    return { processed: 0, stored: 0 };
  }

  const targetDate = latestDateRow.period_date;
  const fiveYearsAgo = new Date(targetDate);
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  const pastDateStr = fiveYearsAgo.toISOString().split('T')[0];
  const pastDateMax = new Date(fiveYearsAgo.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  console.log(`  Current date: ${targetDate}`);
  console.log(`  5-year ago window: ${pastDateStr} to ${pastDateMax}`);

  // Get current data
  const { data: currentData } = await supabase
    .from('realtor_metro')
    .select('cbsa_code, cbsa_title, median_listing_price')
    .eq('period_date', targetDate)
    .not('median_listing_price', 'is', null);

  if (!currentData || currentData.length === 0) {
    return { processed: 0, stored: 0 };
  }

  console.log(`  Found ${currentData.length} metros with current data`);

  // Get historical data
  const { data: pastData } = await supabase
    .from('realtor_metro')
    .select('cbsa_code, median_listing_price')
    .gte('period_date', pastDateStr)
    .lte('period_date', pastDateMax)
    .not('median_listing_price', 'is', null)
    .order('period_date', { ascending: true });

  // Build lookup for past values
  const pastByRegion: Record<string, number> = {};
  if (pastData) {
    for (const row of pastData) {
      if (!pastByRegion[row.cbsa_code]) {
        pastByRegion[row.cbsa_code] = row.median_listing_price;
      }
    }
  }
  console.log(`  Found ${Object.keys(pastByRegion).length} metros with historical data`);

  // Calculate and store
  let stored = 0;
  for (const metro of currentData) {
    const pastValue = pastByRegion[metro.cbsa_code];
    if (!pastValue || pastValue === 0) continue;

    const growthPct = ((metro.median_listing_price - pastValue) / pastValue) * 100;

    const { error } = await supabase
      .from('calculated_metrics')
      .upsert({
        geography_id: metro.cbsa_code,
        geography_type: 'metro',
        geography_name: metro.cbsa_title,
        period_date: targetDate,
        home_value_5yr_cagr: Math.round(growthPct * 100) / 100,
        calculated_at: new Date().toISOString(),
      }, {
        onConflict: 'geography_id,geography_type,period_date',
      });

    if (!error) stored++;
  }

  console.log(`  ✓ Stored ${stored} 5-year growth records`);
  return { processed: currentData.length, stored };
}

async function calculate5YrGrowthForStates(): Promise<{ processed: number; stored: number }> {
  console.log('\n📊 Calculating 5-year growth for states...');

  const { data: latestDateRow } = await supabase
    .from('realtor_state')
    .select('period_date')
    .order('period_date', { ascending: false })
    .limit(1)
    .single();

  if (!latestDateRow?.period_date) {
    return { processed: 0, stored: 0 };
  }

  const targetDate = latestDateRow.period_date;
  const fiveYearsAgo = new Date(targetDate);
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  const pastDateStr = fiveYearsAgo.toISOString().split('T')[0];
  const pastDateMax = new Date(fiveYearsAgo.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const { data: currentData } = await supabase
    .from('realtor_state')
    .select('state_id, state_name, median_listing_price')
    .eq('period_date', targetDate)
    .not('median_listing_price', 'is', null);

  if (!currentData || currentData.length === 0) {
    return { processed: 0, stored: 0 };
  }

  console.log(`  Found ${currentData.length} states with current data`);

  const { data: pastData } = await supabase
    .from('realtor_state')
    .select('state_id, median_listing_price')
    .gte('period_date', pastDateStr)
    .lte('period_date', pastDateMax)
    .not('median_listing_price', 'is', null)
    .order('period_date', { ascending: true });

  const pastByRegion: Record<string, number> = {};
  if (pastData) {
    for (const row of pastData) {
      if (!pastByRegion[row.state_id]) {
        pastByRegion[row.state_id] = row.median_listing_price;
      }
    }
  }

  let stored = 0;
  for (const state of currentData) {
    const pastValue = pastByRegion[state.state_id];
    if (!pastValue || pastValue === 0) continue;

    const growthPct = ((state.median_listing_price - pastValue) / pastValue) * 100;

    const { error } = await supabase
      .from('calculated_metrics')
      .upsert({
        geography_id: state.state_id,
        geography_type: 'state',
        geography_name: state.state_name,
        period_date: targetDate,
        home_value_5yr_cagr: Math.round(growthPct * 100) / 100,
        calculated_at: new Date().toISOString(),
      }, {
        onConflict: 'geography_id,geography_type,period_date',
      });

    if (!error) stored++;
  }

  console.log(`  ✓ Stored ${stored} state 5-year growth records`);
  return { processed: currentData.length, stored };
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('         POPULATE CALCULATED METRICS');
  console.log('═══════════════════════════════════════════════════════════════');

  const results: Record<string, any> = {};

  // 1. Investment Metrics (cap_rate, gross_yield, rent_to_price, grm)
  results.investmentMetrics = await calculateInvestmentMetricsForMetros();

  // 2. Overvalued Percentage
  results.overvalued = await calculateOvervaluedForMetros();

  // 3. 5-Year Growth
  results.growth5YrMetros = await calculate5YrGrowthForMetros();
  results.growth5YrStates = await calculate5YrGrowthForStates();

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('                       SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');

  let totalProcessed = 0;
  let totalStored = 0;

  for (const [key, value] of Object.entries(results)) {
    console.log(`\n${key}:`);
    console.log(`  Processed: ${value.processed}`);
    console.log(`  Stored: ${value.stored}`);
    if (value.errors && value.errors.length > 0) {
      console.log(`  Errors: ${value.errors.join(', ')}`);
    }
    totalProcessed += value.processed;
    totalStored += value.stored;
  }

  console.log('\n───────────────────────────────────────────────────────────────');
  console.log(`TOTAL: Processed ${totalProcessed}, Stored ${totalStored}`);
  console.log('═══════════════════════════════════════════════════════════════');

  // Verify data
  console.log('\n📋 Verifying stored data...');

  const { data: sampleData, error: sampleError } = await supabase
    .from('calculated_metrics')
    .select('*')
    .eq('geography_type', 'metro')
    .not('cap_rate', 'is', null)
    .limit(5);

  if (sampleData && sampleData.length > 0) {
    console.log('\nSample calculated metrics:');
    for (const row of sampleData) {
      console.log(`  ${row.geography_name}: cap_rate=${row.cap_rate}%, gross_yield=${row.gross_yield}%, grm=${row.grm}`);
    }
  }

  const { count } = await supabase
    .from('calculated_metrics')
    .select('*', { count: 'exact', head: true })
    .not('cap_rate', 'is', null);

  console.log(`\n✓ Total records with cap_rate: ${count}`);
}

main().catch(console.error);
