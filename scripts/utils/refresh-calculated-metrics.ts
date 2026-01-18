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

// Income-to-Buy constants
const DOWN_PAYMENT_PCT = 0.20;        // 20% down payment
const DEFAULT_MORTGAGE_RATE = 0.07;   // 7% fallback if FRED unavailable
const MORTGAGE_TERM_MONTHS = 360;     // 30 years
const PROPERTY_TAX_RATE = 0.011;      // 1.1% national average
const INSURANCE_RATE = 0.0035;        // 0.35% national average
const FRONT_END_DTI = 0.28;           // 28% housing-to-income ratio

// FRED API for mortgage rates
const FRED_API_KEY = process.env.FRED_API_KEY || '';
const FRED_MORTGAGE_SERIES = 'MORTGAGE30US';  // 30-Year Fixed Rate Mortgage Average

// ============================================================================
// FRED MORTGAGE RATE FETCH
// ============================================================================

async function fetchMortgageRateFromFRED(): Promise<number> {
  if (!FRED_API_KEY) {
    console.log('   No FRED_API_KEY, using default rate');
    return DEFAULT_MORTGAGE_RATE;
  }

  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${FRED_MORTGAGE_SERIES}&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=1`;
    const response = await fetch(url);

    if (!response.ok) {
      console.log(`   FRED API error: ${response.status}, using default rate`);
      return DEFAULT_MORTGAGE_RATE;
    }

    const data = await response.json();
    if (data.observations && data.observations.length > 0) {
      const latestRate = parseFloat(data.observations[0].value);
      if (!isNaN(latestRate)) {
        console.log(`   FRED mortgage rate: ${latestRate}% (${data.observations[0].date})`);
        return latestRate / 100; // Convert percentage to decimal
      }
    }

    console.log('   No valid FRED data, using default rate');
    return DEFAULT_MORTGAGE_RATE;
  } catch (error) {
    console.log('   FRED fetch failed, using default rate');
    return DEFAULT_MORTGAGE_RATE;
  }
}

// ============================================================================
// CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate Income to Buy (annual income needed to afford home purchase)
 * Formula: (Monthly Mortgage + Taxes + Insurance) × 12 / 0.28
 */
function calculateIncomeToBuy(price: number, mortgageRate: number): number | null {
  if (!price || price === 0) return null;

  const loanAmount = price * (1 - DOWN_PAYMENT_PCT);
  const monthlyRate = mortgageRate / 12;

  // Monthly mortgage payment (standard amortization formula)
  // M = P × [r(1+r)^n] / [(1+r)^n - 1]
  const factor = Math.pow(1 + monthlyRate, MORTGAGE_TERM_MONTHS);
  const monthlyMortgage = loanAmount * (monthlyRate * factor) / (factor - 1);

  // Monthly taxes and insurance
  const monthlyTaxes = (price * PROPERTY_TAX_RATE) / 12;
  const monthlyInsurance = (price * INSURANCE_RATE) / 12;

  // Total monthly PITI
  const monthlyPITI = monthlyMortgage + monthlyTaxes + monthlyInsurance;

  // Required annual income (28% front-end DTI)
  const annualIncome = (monthlyPITI * 12) / FRONT_END_DTI;

  return Math.round(annualIncome);
}

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
// INCOME TO BUY CALCULATION (ALL GEOGRAPHIES)
// ============================================================================

interface GeoConfig {
  tableName: string;
  geoType: string;
  idField: string;
  nameField: string;
}

const GEO_CONFIGS: GeoConfig[] = [
  { tableName: 'realtor_national', geoType: 'national', idField: "'US'", nameField: "'United States'" },
  { tableName: 'realtor_state', geoType: 'state', idField: 'state_id', nameField: 'state_name' },
  { tableName: 'realtor_metro', geoType: 'metro', idField: 'cbsa_code', nameField: 'cbsa_title' },
  { tableName: 'realtor_county', geoType: 'county', idField: 'county_fips', nameField: 'county_name' },
  { tableName: 'realtor_zip', geoType: 'zip', idField: 'postal_code', nameField: 'zip_name' },
];

async function calculateIncomeToBuyForGeo(
  supabase: SupabaseClient,
  config: GeoConfig,
  mortgageRate: number
): Promise<{ processed: number; stored: number; errors: string[] }> {
  const errors: string[] = [];
  const PAGE_SIZE = 1000; // Supabase default limit is 1000, use this for pagination

  // Get latest date for this table
  const { data: latestRow } = await supabase
    .from(config.tableName)
    .select('period_date')
    .order('period_date', { ascending: false })
    .limit(1)
    .single();

  if (!latestRow?.period_date) {
    return { processed: 0, stored: 0, errors: [`No data in ${config.tableName}`] };
  }

  const targetDate = latestRow.period_date;

  // Paginated fetch to handle large tables (county has 3000+, zip has 28000+)
  let allData: any[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    let query;
    if (config.geoType === 'national') {
      query = supabase
        .from(config.tableName)
        .select('median_listing_price')
        .eq('period_date', targetDate)
        .not('median_listing_price', 'is', null)
        .range(offset, offset + PAGE_SIZE - 1);
    } else {
      query = supabase
        .from(config.tableName)
        .select(`${config.idField}, ${config.nameField}, median_listing_price`)
        .eq('period_date', targetDate)
        .not('median_listing_price', 'is', null)
        .range(offset, offset + PAGE_SIZE - 1);
    }

    const { data, error } = await query;

    if (error) {
      errors.push(error.message);
      break;
    }

    if (data && data.length > 0) {
      allData = allData.concat(data);
      offset += data.length;
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }

  if (allData.length === 0) {
    return { processed: 0, stored: 0, errors: errors.length > 0 ? errors : [`No data for ${config.tableName}`] };
  }

  let stored = 0;
  const records: any[] = [];

  for (const row of allData) {
    const price = row.median_listing_price;
    const incomeToBuy = calculateIncomeToBuy(price, mortgageRate);

    if (incomeToBuy === null) continue;

    let geoId: string;
    let geoName: string;

    if (config.geoType === 'national') {
      geoId = 'US';
      geoName = 'United States';
    } else {
      geoId = String(row[config.idField]);
      geoName = row[config.nameField] || geoId;
    }

    records.push({
      geography_id: geoId,
      geography_type: config.geoType,
      geography_name: geoName,
      period_date: targetDate,
      income_to_buy: incomeToBuy,
      calculated_at: new Date().toISOString(),
    });

    if (records.length >= BATCH_SIZE) {
      const { error: upsertError } = await supabase
        .from('calculated_metrics')
        .upsert(records, { onConflict: 'geography_id,geography_type,period_date' });
      if (upsertError) errors.push(upsertError.message);
      else stored += records.length;
      records.length = 0;
    }
  }

  if (records.length > 0) {
    const { error: upsertError } = await supabase
      .from('calculated_metrics')
      .upsert(records, { onConflict: 'geography_id,geography_type,period_date' });
    if (upsertError) errors.push(upsertError.message);
    else stored += records.length;
  }

  return { processed: allData.length, stored, errors };
}

async function calculateAllIncomeToBuy(
  supabase: SupabaseClient
): Promise<{ total: { processed: number; stored: number }; byGeo: Record<string, { processed: number; stored: number }> }> {
  // Fetch current mortgage rate from FRED
  const mortgageRate = await fetchMortgageRateFromFRED();

  const byGeo: Record<string, { processed: number; stored: number }> = {};
  let totalProcessed = 0;
  let totalStored = 0;

  for (const config of GEO_CONFIGS) {
    const result = await calculateIncomeToBuyForGeo(supabase, config, mortgageRate);
    byGeo[config.geoType] = { processed: result.processed, stored: result.stored };
    totalProcessed += result.processed;
    totalStored += result.stored;
  }

  return { total: { processed: totalProcessed, stored: totalStored }, byGeo };
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
  incomeToBuy: { total: { processed: number; stored: number }; byGeo: Record<string, { processed: number; stored: number }> };
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

  // Run calculations (income_to_buy runs sequentially due to FRED API call)
  const [investmentMetrics, overvalued, growth5YrMetros, growth5YrStates] = await Promise.all([
    calculateInvestmentMetrics(supabase),
    calculateOvervaluedMetrics(supabase),
    calculate5YrGrowth(supabase, 'metro'),
    calculate5YrGrowth(supabase, 'state'),
  ]);

  // Income-to-Buy calculation (all geographies)
  log('   Calculating income-to-buy...');
  const incomeToBuy = await calculateAllIncomeToBuy(supabase);

  const duration = Date.now() - startTime;
  const totalProcessed = investmentMetrics.processed + overvalued.processed +
                         growth5YrMetros.processed + growth5YrStates.processed +
                         incomeToBuy.total.processed;
  const totalStored = investmentMetrics.stored + overvalued.stored +
                      growth5YrMetros.stored + growth5YrStates.stored +
                      incomeToBuy.total.stored;

  log(`   Investment metrics: ${investmentMetrics.stored} stored`);
  log(`   Overvalued %: ${overvalued.stored} stored`);
  log(`   5-yr growth metros: ${growth5YrMetros.stored} stored`);
  log(`   5-yr growth states: ${growth5YrStates.stored} stored`);
  log(`   Income-to-buy: ${incomeToBuy.total.stored} stored (${Object.keys(incomeToBuy.byGeo).map(g => `${g}:${incomeToBuy.byGeo[g].stored}`).join(', ')})`);
  log(`   Total: ${totalStored} records in ${(duration / 1000).toFixed(1)}s`);

  return {
    investmentMetrics,
    overvalued,
    growth5YrMetros,
    growth5YrStates,
    incomeToBuy,
    totalProcessed,
    totalStored,
    duration,
  };
}

// To run standalone, use: npx tsx scripts/populate-calculated-metrics.ts
