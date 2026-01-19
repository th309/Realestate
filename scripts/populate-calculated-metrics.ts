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

// Data validation bounds - filter out unreasonable data
const MIN_VALID_PRICE = 10000;      // $10,000 minimum home price
const MAX_VALID_PRICE = 50000000;   // $50M maximum home price
const MIN_VALID_RENT = 100;         // $100/month minimum rent
const MAX_VALID_RENT = 15000;       // $15,000/month maximum rent
const MIN_VALID_CAP_RATE = 0.5;     // 0.5% minimum cap rate
const MAX_VALID_CAP_RATE = 20;      // 20% maximum cap rate

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

function isValidRent(rent: number): boolean {
  return rent >= MIN_VALID_RENT && rent <= MAX_VALID_RENT;
}

function isValidPrice(price: number): boolean {
  return price >= MIN_VALID_PRICE && price <= MAX_VALID_PRICE;
}

function isValidCapRate(capRate: number): boolean {
  return capRate >= MIN_VALID_CAP_RATE && capRate <= MAX_VALID_CAP_RATE;
}

// ============================================================================
// CALCULATION FUNCTIONS
// ============================================================================

function calculateCapRate(rent: number, price: number): number | null {
  if (!rent || !price || price === 0) return null;
  if (!isValidRent(rent) || !isValidPrice(price)) return null;
  const capRate = (rent * 12 * EXPENSE_RATIO) / price * 100;
  // Return null if cap rate is outside valid bounds
  if (!isValidCapRate(capRate)) return null;
  return capRate;
}

function calculateGrossYield(rent: number, price: number): number | null {
  if (!rent || !price || price === 0) return null;
  if (!isValidRent(rent) || !isValidPrice(price)) return null;
  return (rent * 12) / price * 100;
}

function calculateRentToPriceRatio(rent: number, price: number): number | null {
  if (!rent || !price || price === 0) return null;
  if (!isValidRent(rent) || !isValidPrice(price)) return null;
  return rent / price;
}

function calculateGRM(price: number, rent: number): number | null {
  if (!price || !rent || rent === 0) return null;
  if (!isValidRent(rent) || !isValidPrice(price)) return null;
  return price / (rent * 12);
}

function calculateOvervalued(price: number, income: number): number | null {
  if (!price || !income || income === 0) return null;
  const priceToIncome = price / income;
  return ((priceToIncome - PRICE_TO_INCOME_BENCHMARK) / PRICE_TO_INCOME_BENCHMARK) * 100;
}

// ============================================================================
// INVESTMENT METRICS CALCULATION
// ============================================================================

interface InvestmentGeoConfig {
  zillowTable: string;
  realtorTable: string;
  censusTable: string;
  geoType: 'metro' | 'county' | 'zip';
  zillowIdField: string;
  realtorIdField: string;
  censusIdField: string;
  censusNameField: string | null;
}

const INVESTMENT_GEO_CONFIGS: InvestmentGeoConfig[] = [
  { zillowTable: 'zillow_metro', realtorTable: 'realtor_metro', censusTable: 'census_metro', geoType: 'metro', zillowIdField: 'cbsa_code', realtorIdField: 'cbsa_code', censusIdField: 'cbsa_code', censusNameField: 'cbsa_title' },
  { zillowTable: 'zillow_county', realtorTable: 'realtor_county', censusTable: 'census_county', geoType: 'county', zillowIdField: 'fips_code', realtorIdField: 'county_fips', censusIdField: 'fips_code', censusNameField: 'county_name' },
  { zillowTable: 'zillow_zip', realtorTable: 'realtor_zip', censusTable: 'census_zip', geoType: 'zip', zillowIdField: 'region_name', realtorIdField: 'postal_code', censusIdField: 'zcta', censusNameField: null },
];

async function calculateInvestmentMetricsForGeo(config: InvestmentGeoConfig): Promise<{ processed: number; stored: number; errors: string[] }> {
  console.log(`\n📊 Calculating investment metrics for ${config.geoType}...`);
  const errors: string[] = [];
  const PAGE_SIZE = 1000;

  // ============================================
  // STEP 1: Get ZORI data (primary rent source)
  // ============================================
  let allZoriData: any[] = [];
  let offset = 0;

  console.log(`  Fetching ZORI data (primary rent source)...`);
  while (true) {
    const { data, error } = await supabase
      .from(config.zillowTable)
      .select(`region_id, region_name, value, period_date, ${config.zillowIdField}`)
      .eq('metric_name', 'zori')
      .not('value', 'is', null)
      .order('period_date', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      errors.push(error.message);
      break;
    }
    if (!data || data.length === 0) break;
    allZoriData = allZoriData.concat(data);
    if (data.length < PAGE_SIZE) break;
    offset += data.length;

    if (offset % 10000 === 0) {
      console.log(`    Fetched ${offset} ZORI records...`);
    }
  }

  console.log(`  Total ZORI records: ${allZoriData.length}`);

  // Keep only the most recent ZORI value for each geography
  const rentByGeo: Record<string, { value: number; name: string; date: string; source: 'zori' | 'census' }> = {};
  let zoriSkippedInvalid = 0;
  for (const row of allZoriData) {
    const geoId = row[config.zillowIdField];
    if (!geoId) continue;

    // Validate ZORI value
    if (!isValidRent(row.value)) {
      zoriSkippedInvalid++;
      continue;
    }

    if (!rentByGeo[geoId]) {
      rentByGeo[geoId] = {
        value: row.value,
        name: row.region_name,
        date: row.period_date,
        source: 'zori',
      };
    }
  }

  if (zoriSkippedInvalid > 0) {
    console.log(`    ⚠️ Skipped ${zoriSkippedInvalid} ZORI records with invalid values`);
  }

  const zoriCount = Object.keys(rentByGeo).length;
  console.log(`  Unique ${config.geoType}s with ZORI data: ${zoriCount}`);

  // ============================================
  // STEP 2: Get Census median_gross_rent as fallback
  // ============================================
  console.log(`  Fetching Census median_gross_rent (fallback rent source)...`);
  let allCensusRent: any[] = [];
  offset = 0;

  // Build select fields based on config
  const censusSelectFields = config.censusNameField
    ? `${config.censusIdField}, ${config.censusNameField}, median_gross_rent, year`
    : `${config.censusIdField}, median_gross_rent, year`;

  while (true) {
    const { data, error } = await supabase
      .from(config.censusTable)
      .select(censusSelectFields)
      .not('median_gross_rent', 'is', null)
      .gt('median_gross_rent', 0) // Filter out negative sentinel values (-666666666)
      .order('year', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.log(`    Census query error: ${error.message}`);
      errors.push(error.message);
      break;
    }
    if (!data || data.length === 0) break;
    allCensusRent = allCensusRent.concat(data);
    if (data.length < PAGE_SIZE) break;
    offset += data.length;

    if (offset % 10000 === 0) {
      console.log(`    Fetched ${offset} Census rent records...`);
    }
  }

  console.log(`  Total Census rent records: ${allCensusRent.length}`);

  // Add Census rent for geographies that don't have ZORI
  let censusAddedCount = 0;
  let censusSkippedInvalid = 0;
  for (const row of allCensusRent) {
    const geoId = row[config.censusIdField];
    if (!geoId) continue;

    // Validate rent value
    const rentValue = row.median_gross_rent;
    if (!isValidRent(rentValue)) {
      censusSkippedInvalid++;
      continue;
    }

    // Only add if we don't already have rent data (ZORI takes priority)
    if (!rentByGeo[geoId]) {
      const geoName = config.censusNameField
        ? row[config.censusNameField]
        : `${config.geoType.toUpperCase()} ${geoId}`;

      rentByGeo[geoId] = {
        value: rentValue,
        name: geoName || `${config.geoType.toUpperCase()} ${geoId}`,
        date: `${row.year}-12-31`,
        source: 'census',
      };
      censusAddedCount++;
    }
  }

  if (censusSkippedInvalid > 0) {
    console.log(`    ⚠️ Skipped ${censusSkippedInvalid} Census records with invalid rent values`);
  }

  console.log(`  Added ${censusAddedCount} ${config.geoType}s from Census (no ZORI coverage)`);

  const totalRentGeos = Object.keys(rentByGeo).length;
  console.log(`  Total ${config.geoType}s with rent data: ${totalRentGeos}`);

  if (totalRentGeos === 0) {
    return { processed: 0, stored: 0, errors };
  }

  // Get ALL Realtor listing price data (most recent per geography)
  // This maximizes coverage by using whatever price data is available
  let allPriceData: any[] = [];
  offset = 0;

  console.log(`  Fetching all price data...`);
  while (true) {
    const { data, error } = await supabase
      .from(config.realtorTable)
      .select(`${config.realtorIdField}, median_listing_price, period_date`)
      .not('median_listing_price', 'is', null)
      .order('period_date', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      errors.push(error.message);
      break;
    }
    if (!data || data.length === 0) break;
    allPriceData = allPriceData.concat(data);
    if (data.length < PAGE_SIZE) break;
    offset += data.length;

    if (offset % 10000 === 0) {
      console.log(`    Fetched ${offset} price records...`);
    }
  }

  console.log(`  Total price records: ${allPriceData.length}`);

  // Keep only the most recent valid price for each geography
  const priceByCode: Record<string, number> = {};
  let priceSkippedInvalid = 0;
  for (const row of allPriceData as any[]) {
    const id = row[config.realtorIdField];
    const price = row.median_listing_price;

    // Validate price
    if (!isValidPrice(price)) {
      priceSkippedInvalid++;
      continue;
    }

    if (id && !priceByCode[id]) {
      priceByCode[id] = price;
    }
  }

  if (priceSkippedInvalid > 0) {
    console.log(`    ⚠️ Skipped ${priceSkippedInvalid} price records with invalid values`);
  }
  console.log(`  Unique ${config.geoType}s with valid price data: ${Object.keys(priceByCode).length}`);

  // Get the most recent Realtor date for period_date field
  const { data: realtorDateRow } = await supabase
    .from(config.realtorTable)
    .select('period_date')
    .order('period_date', { ascending: false })
    .limit(1)
    .single();

  const realtorDate = realtorDateRow?.period_date || new Date().toISOString().split('T')[0];

  // Calculate and batch upsert
  let stored = 0;
  let matched = 0;
  let zoriMatched = 0;
  let censusMatched = 0;
  let skippedNoValidMetric = 0;
  const recordsToUpsert: any[] = [];

  for (const [geoId, rentInfo] of Object.entries(rentByGeo)) {
    const rent = rentInfo.value;
    const price = priceByCode[geoId];

    if (!rent || !price) continue;
    matched++;
    if (rentInfo.source === 'zori') zoriMatched++;
    else censusMatched++;

    let geoName = rentInfo.name;
    if (config.geoType === 'zip') {
      geoName = geoName || `ZIP ${geoId}`;
    }

    const capRate = calculateCapRate(rent, price);
    const grossYield = calculateGrossYield(rent, price);
    const rentToPriceRatio = calculateRentToPriceRatio(rent, price);
    const grm = calculateGRM(price, rent);

    // Skip records where all metrics are null (invalid data)
    if (capRate === null && grossYield === null && rentToPriceRatio === null && grm === null) {
      skippedNoValidMetric++;
      continue;
    }

    recordsToUpsert.push({
      geography_id: geoId,
      geography_type: config.geoType,
      geography_name: geoName,
      period_date: realtorDate,
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

  console.log(`  Matched ${matched} ${config.geoType}s with both rent and price data`);
  console.log(`    - ${zoriMatched} using ZORI (current rent)`);
  console.log(`    - ${censusMatched} using Census median_gross_rent (fallback)`);
  if (skippedNoValidMetric > 0) {
    console.log(`    ⚠️ Skipped ${skippedNoValidMetric} records with data outside valid bounds`);
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

  console.log(`  ✓ Stored ${stored} ${config.geoType} investment metrics records`);
  return { processed: totalRentGeos, stored, errors };
}

async function calculateAllInvestmentMetrics(): Promise<{ processed: number; stored: number; errors: string[]; byGeo: Record<string, number> }> {
  let totalProcessed = 0;
  let totalStored = 0;
  const allErrors: string[] = [];
  const byGeo: Record<string, number> = {};

  for (const config of INVESTMENT_GEO_CONFIGS) {
    const result = await calculateInvestmentMetricsForGeo(config);
    totalProcessed += result.processed;
    totalStored += result.stored;
    allErrors.push(...result.errors);
    byGeo[config.geoType] = result.stored;
  }

  return { processed: totalProcessed, stored: totalStored, errors: allErrors, byGeo };
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

  // 1. Investment Metrics (cap_rate, gross_yield, rent_to_price, grm) - ALL GEOGRAPHIES
  results.investmentMetrics = await calculateAllInvestmentMetrics();

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
    if (value.byGeo) {
      console.log(`  By geo: ${Object.entries(value.byGeo).map(([g, c]) => `${g}:${c}`).join(', ')}`);
    }
    if (value.errors && value.errors.length > 0) {
      console.log(`  Errors: ${value.errors.slice(0, 3).join(', ')}`);
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
