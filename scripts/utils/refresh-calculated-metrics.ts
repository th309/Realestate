/**
 * Refresh Calculated Metrics - Post-Import Hook
 *
 * This utility recalculates all derived metrics after data imports.
 * Call this at the end of any import script to keep calculated metrics up to date.
 *
 * Usage:
 *   import { refreshCalculatedMetrics } from './utils/refresh-calculated-metrics';
 *   await refreshCalculatedMetrics();
 */

import { SupabaseClient } from '@supabase/supabase-js';

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

async function calculateInvestmentMetrics(
  supabase: SupabaseClient
): Promise<{ processed: number; stored: number; errors: string[] }> {
  const errors: string[] = [];

  // Get latest ZORI date
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

  // Get ZORI data
  const { data: zoriData, error: zoriError } = await supabase
    .from('zillow_metro')
    .select('region_id, region_name, value, cbsa_code')
    .eq('metric_name', 'zori')
    .eq('period_date', targetDate)
    .not('value', 'is', null);

  if (zoriError || !zoriData) {
    return { processed: 0, stored: 0, errors: [zoriError?.message || 'Failed to fetch ZORI'] };
  }

  // Get Realtor listing prices
  const { data: realtorDateRow } = await supabase
    .from('realtor_metro')
    .select('period_date')
    .order('period_date', { ascending: false })
    .limit(1)
    .single();

  const realtorDate = realtorDateRow?.period_date || targetDate;

  const { data: realtorData } = await supabase
    .from('realtor_metro')
    .select('cbsa_code, median_listing_price')
    .eq('period_date', realtorDate)
    .not('median_listing_price', 'is', null);

  const priceByCode: Record<string, number> = {};
  if (realtorData) {
    for (const row of realtorData) {
      if (row.cbsa_code && row.median_listing_price) {
        priceByCode[row.cbsa_code] = row.median_listing_price;
      }
    }
  }

  // Calculate and upsert
  let stored = 0;
  const records: any[] = [];

  for (const metro of zoriData) {
    const cbsaCode = metro.cbsa_code;
    const zori = metro.value;
    const price = cbsaCode ? priceByCode[cbsaCode] : null;

    if (!zori || !price) continue;

    records.push({
      geography_id: cbsaCode,
      geography_type: 'metro',
      geography_name: metro.region_name,
      period_date: targetDate,
      cap_rate: calculateCapRate(zori, price) ? Math.round(calculateCapRate(zori, price)! * 100) / 100 : null,
      gross_yield: calculateGrossYield(zori, price) ? Math.round(calculateGrossYield(zori, price)! * 100) / 100 : null,
      rent_to_price_ratio: calculateRentToPriceRatio(zori, price) ? Math.round(calculateRentToPriceRatio(zori, price)! * 10000) / 10000 : null,
      grm: calculateGRM(price, zori) ? Math.round(calculateGRM(price, zori)! * 100) / 100 : null,
      calculated_at: new Date().toISOString(),
    });

    if (records.length >= BATCH_SIZE) {
      const { error } = await supabase
        .from('calculated_metrics')
        .upsert(records, { onConflict: 'geography_id,geography_type,period_date' });
      if (error) errors.push(error.message);
      else stored += records.length;
      records.length = 0;
    }
  }

  if (records.length > 0) {
    const { error } = await supabase
      .from('calculated_metrics')
      .upsert(records, { onConflict: 'geography_id,geography_type,period_date' });
    if (error) errors.push(error.message);
    else stored += records.length;
  }

  return { processed: zoriData.length, stored, errors };
}

// ============================================================================
// OVERVALUED CALCULATION
// ============================================================================

async function calculateOvervaluedMetrics(
  supabase: SupabaseClient
): Promise<{ processed: number; stored: number; errors: string[] }> {
  const errors: string[] = [];

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

  const { data: zhviData, error: zhviError } = await supabase
    .from('zillow_metro')
    .select('region_id, region_name, value, cbsa_code')
    .eq('metric_name', 'zhvi')
    .eq('period_date', targetDate)
    .not('value', 'is', null);

  if (zhviError || !zhviData) {
    return { processed: 0, stored: 0, errors: [zhviError?.message || 'Failed to fetch ZHVI'] };
  }

  // Get Census income data
  const { data: incomeData } = await supabase
    .from('census_data')
    .select('geography_id, value')
    .eq('geography_type', 'metro')
    .eq('metric_name', 'median_income')
    .order('year', { ascending: false });

  const incomeByGeo: Record<string, number> = {};
  if (incomeData) {
    for (const row of incomeData) {
      if (row.value && !incomeByGeo[row.geography_id]) {
        incomeByGeo[row.geography_id] = Number(row.value);
      }
    }
  }

  let stored = 0;
  const records: any[] = [];

  for (const metro of zhviData) {
    const cbsaCode = metro.cbsa_code;
    if (!cbsaCode) continue;

    const zhvi = metro.value;
    const medianIncome = incomeByGeo[cbsaCode] || NATIONAL_MEDIAN_INCOME;
    const overvaluedPct = calculateOvervalued(zhvi, medianIncome);

    if (overvaluedPct === null) continue;

    records.push({
      geography_id: cbsaCode,
      geography_type: 'metro',
      geography_name: metro.region_name,
      period_date: targetDate,
      overvalued_pct: Math.round(overvaluedPct * 10) / 10,
      calculated_at: new Date().toISOString(),
    });

    if (records.length >= BATCH_SIZE) {
      const { error } = await supabase
        .from('calculated_metrics')
        .upsert(records, { onConflict: 'geography_id,geography_type,period_date' });
      if (error) errors.push(error.message);
      else stored += records.length;
      records.length = 0;
    }
  }

  if (records.length > 0) {
    const { error } = await supabase
      .from('calculated_metrics')
      .upsert(records, { onConflict: 'geography_id,geography_type,period_date' });
    if (error) errors.push(error.message);
    else stored += records.length;
  }

  return { processed: zhviData.length, stored, errors };
}

// ============================================================================
// 5-YEAR GROWTH CALCULATION
// ============================================================================

async function calculate5YrGrowth(
  supabase: SupabaseClient,
  geoType: 'metro' | 'state'
): Promise<{ processed: number; stored: number }> {
  const tableName = geoType === 'metro' ? 'realtor_metro' : 'realtor_state';
  const idField = geoType === 'metro' ? 'cbsa_code' : 'state_id';
  const nameField = geoType === 'metro' ? 'cbsa_title' : 'state_name';

  const { data: latestDateRow } = await supabase
    .from(tableName)
    .select('period_date')
    .order('period_date', { ascending: false })
    .limit(1)
    .single();

  if (!latestDateRow?.period_date) return { processed: 0, stored: 0 };

  const targetDate = latestDateRow.period_date;
  const fiveYearsAgo = new Date(targetDate);
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  const pastDateStr = fiveYearsAgo.toISOString().split('T')[0];
  const pastDateMax = new Date(fiveYearsAgo.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const { data: currentData } = await supabase
    .from(tableName)
    .select(`${idField}, ${nameField}, median_listing_price`)
    .eq('period_date', targetDate)
    .not('median_listing_price', 'is', null);

  if (!currentData || currentData.length === 0) return { processed: 0, stored: 0 };

  const { data: pastData } = await supabase
    .from(tableName)
    .select(`${idField}, median_listing_price`)
    .gte('period_date', pastDateStr)
    .lte('period_date', pastDateMax)
    .not('median_listing_price', 'is', null)
    .order('period_date', { ascending: true });

  const pastByRegion: Record<string, number> = {};
  if (pastData) {
    for (const row of pastData as any[]) {
      const id = row[idField];
      if (!pastByRegion[id]) pastByRegion[id] = row.median_listing_price;
    }
  }

  let stored = 0;
  for (const item of currentData as any[]) {
    const id = item[idField];
    const pastValue = pastByRegion[id];
    if (!pastValue || pastValue === 0) continue;

    const growthPct = ((item.median_listing_price - pastValue) / pastValue) * 100;

    const { error } = await supabase
      .from('calculated_metrics')
      .upsert({
        geography_id: id,
        geography_type: geoType,
        geography_name: item[nameField],
        period_date: targetDate,
        home_value_5yr_cagr: Math.round(growthPct * 100) / 100,
        calculated_at: new Date().toISOString(),
      }, { onConflict: 'geography_id,geography_type,period_date' });

    if (!error) stored++;
  }

  return { processed: currentData.length, stored };
}

// ============================================================================
// MAIN REFRESH FUNCTION
// ============================================================================

export interface RefreshResult {
  investmentMetrics: { processed: number; stored: number; errors: string[] };
  overvalued: { processed: number; stored: number; errors: string[] };
  growth5YrMetros: { processed: number; stored: number };
  growth5YrStates: { processed: number; stored: number };
  totalProcessed: number;
  totalStored: number;
  duration: number;
}

/**
 * Refresh all calculated metrics
 * Call this after any data import to update derived metrics
 */
export async function refreshCalculatedMetrics(
  supabase: SupabaseClient,
  options: { silent?: boolean } = {}
): Promise<RefreshResult> {
  const startTime = Date.now();
  const log = options.silent ? () => {} : console.log;

  log('\n📊 Refreshing calculated metrics...');

  // Run calculations
  const [investmentMetrics, overvalued, growth5YrMetros, growth5YrStates] = await Promise.all([
    calculateInvestmentMetrics(supabase),
    calculateOvervaluedMetrics(supabase),
    calculate5YrGrowth(supabase, 'metro'),
    calculate5YrGrowth(supabase, 'state'),
  ]);

  const duration = Date.now() - startTime;
  const totalProcessed = investmentMetrics.processed + overvalued.processed +
                         growth5YrMetros.processed + growth5YrStates.processed;
  const totalStored = investmentMetrics.stored + overvalued.stored +
                      growth5YrMetros.stored + growth5YrStates.stored;

  log(`   Investment metrics: ${investmentMetrics.stored} stored`);
  log(`   Overvalued %: ${overvalued.stored} stored`);
  log(`   5-yr growth metros: ${growth5YrMetros.stored} stored`);
  log(`   5-yr growth states: ${growth5YrStates.stored} stored`);
  log(`   Total: ${totalStored} records in ${(duration / 1000).toFixed(1)}s`);

  return {
    investmentMetrics,
    overvalued,
    growth5YrMetros,
    growth5YrStates,
    totalProcessed,
    totalStored,
    duration,
  };
}

// To run standalone, use: npx tsx scripts/populate-calculated-metrics.ts
