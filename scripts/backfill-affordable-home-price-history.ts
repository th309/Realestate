/**
 * Backfill Affordable Home Price History
 *
 * Calculates and stores affordable_home_price for all geographies and historical months.
 * Uses Census median income data and current mortgage rates.
 *
 * Formula: Max home price = Max Monthly PITI / (0.80 × PMT_factor + tax/insurance rate)
 * Where Max Monthly PITI = (Annual Income × 0.28) / 12
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Constants (same as income_to_buy)
const DOWN_PAYMENT_PCT = 0.20;
const DEFAULT_MORTGAGE_RATE = 0.07;
const MORTGAGE_TERM_MONTHS = 360;
const PROPERTY_TAX_RATE = 0.011;
const INSURANCE_RATE = 0.0035;
const FRONT_END_DTI = 0.28;

const BATCH_SIZE = 500;
const PAGE_SIZE = 1000;

// National median income fallback
const NATIONAL_MEDIAN_INCOME = 75000;

/**
 * Calculate Affordable Home Price
 */
function calculateAffordableHomePrice(annualIncome: number, mortgageRate: number): number | null {
  if (!annualIncome || annualIncome === 0) return null;

  const monthlyRate = mortgageRate / 12;
  const factor = Math.pow(1 + monthlyRate, MORTGAGE_TERM_MONTHS);
  const pmtFactor = (monthlyRate * factor) / (factor - 1);

  const maxMonthlyPITI = (annualIncome * FRONT_END_DTI) / 12;
  const taxInsuranceMonthlyRate = (PROPERTY_TAX_RATE + INSURANCE_RATE) / 12;
  const denominator = (1 - DOWN_PAYMENT_PCT) * pmtFactor + taxInsuranceMonthlyRate;
  const homePrice = maxMonthlyPITI / denominator;

  return Math.round(homePrice);
}

/**
 * Get Census median income data for all geographies
 */
async function getCensusIncomeData(): Promise<Record<string, Record<string, number>>> {
  const incomeByGeoType: Record<string, Record<string, number>> = {
    national: { 'US': NATIONAL_MEDIAN_INCOME },
    state: {},
    metro: {},
    county: {},
    zip: {},
  };

  // Get all Census income data
  const { data: incomeData, error } = await supabase
    .from('census_data')
    .select('geography_id, geography_type, value, year')
    .eq('metric_name', 'median_income')
    .not('value', 'is', null)
    .order('year', { ascending: false });

  if (error) {
    console.error('Error fetching Census income:', error.message);
    return incomeByGeoType;
  }

  // Use most recent income for each geography
  for (const row of incomeData || []) {
    const geoType = row.geography_type;
    const geoId = row.geography_id;
    if (incomeByGeoType[geoType] && !incomeByGeoType[geoType][geoId]) {
      incomeByGeoType[geoType][geoId] = Number(row.value);
    }
  }

  console.log('Census income data loaded:');
  console.log(`  National: ${Object.keys(incomeByGeoType.national).length} records`);
  console.log(`  State: ${Object.keys(incomeByGeoType.state).length} records`);
  console.log(`  Metro: ${Object.keys(incomeByGeoType.metro).length} records`);
  console.log(`  County: ${Object.keys(incomeByGeoType.county).length} records`);
  console.log(`  ZIP: ${Object.keys(incomeByGeoType.zip).length} records`);

  return incomeByGeoType;
}

/**
 * Get all unique period dates from calculated_metrics where income_to_buy exists
 * (We use the same dates as income_to_buy since we need price data which exists for those dates)
 */
async function getAvailableDates(geoType: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('calculated_metrics')
    .select('period_date')
    .eq('geography_type', geoType)
    .not('income_to_buy', 'is', null)
    .order('period_date', { ascending: true });

  if (error || !data) return [];

  // Get unique dates
  const uniqueDates = [...new Set(data.map(d => d.period_date))];
  return uniqueDates;
}

/**
 * Process a single geography type
 */
async function processGeoType(
  geoType: string,
  incomeData: Record<string, number>,
  mortgageRate: number
): Promise<{ months: number; records: number }> {
  const dates = await getAvailableDates(geoType);

  if (dates.length === 0) {
    console.log(`   No dates found for ${geoType}`);
    return { months: 0, records: 0 };
  }

  console.log(`   Found ${dates.length} months of data`);

  let totalRecords = 0;

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];

    // Get all records for this date that have income_to_buy (meaning they have price data)
    let allRecords: any[] = [];
    let offset = 0;

    while (true) {
      const { data: pageData, error } = await supabase
        .from('calculated_metrics')
        .select('geography_id, geography_name')
        .eq('geography_type', geoType)
        .eq('period_date', date)
        .not('income_to_buy', 'is', null)
        .range(offset, offset + PAGE_SIZE - 1);

      if (error || !pageData || pageData.length === 0) break;
      allRecords = allRecords.concat(pageData);
      if (pageData.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    // Calculate affordable_home_price for each record
    const updates: any[] = [];

    for (const record of allRecords) {
      const geoId = record.geography_id;

      // Get income for this geography (use national fallback if not found)
      let income = incomeData[geoId];
      if (!income) {
        // Try state-level income for county/zip
        if (geoType === 'county' && geoId.length >= 2) {
          const stateFips = geoId.substring(0, 2);
          // We don't have state FIPS to income mapping here, use national
          income = NATIONAL_MEDIAN_INCOME;
        } else if (geoType === 'zip') {
          income = NATIONAL_MEDIAN_INCOME;
        } else {
          income = NATIONAL_MEDIAN_INCOME;
        }
      }

      const affordablePrice = calculateAffordableHomePrice(income, mortgageRate);
      if (affordablePrice === null) continue;

      updates.push({
        geography_id: geoId,
        geography_type: geoType,
        geography_name: record.geography_name,
        period_date: date,
        affordable_home_price: affordablePrice,
        calculated_at: new Date().toISOString(),
      });

      if (updates.length >= BATCH_SIZE) {
        const { error: upsertError } = await supabase
          .from('calculated_metrics')
          .upsert(updates, { onConflict: 'geography_id,geography_type,period_date' });

        if (upsertError) {
          console.error(`   Error upserting batch: ${upsertError.message}`);
        }
        totalRecords += updates.length;
        updates.length = 0;
      }
    }

    // Upsert remaining
    if (updates.length > 0) {
      const { error: upsertError } = await supabase
        .from('calculated_metrics')
        .upsert(updates, { onConflict: 'geography_id,geography_type,period_date' });

      if (upsertError) {
        console.error(`   Error upserting final batch: ${upsertError.message}`);
      }
      totalRecords += updates.length;
    }

    if ((i + 1) % 10 === 0 || i === dates.length - 1) {
      process.stdout.write(`   Processing: ${i + 1}/${dates.length} months, ${totalRecords} records stored\r`);
    }
  }

  console.log(`\n   ✓ ${geoType}: ${totalRecords} total records stored across ${dates.length} months`);
  return { months: dates.length, records: totalRecords };
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('       BACKFILLING AFFORDABLE HOME PRICE HISTORY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Started: ${new Date().toISOString()}`);
  console.log(`\nUsing mortgage rate: ${(DEFAULT_MORTGAGE_RATE * 100).toFixed(2)}%`);
  console.log('');

  // Get Census income data
  const incomeData = await getCensusIncomeData();
  console.log('');

  const geoTypes = ['national', 'state', 'metro', 'county', 'zip'];
  let grandTotal = 0;

  for (const geoType of geoTypes) {
    console.log(`📊 Processing ${geoType}...`);
    const incomeForGeo = incomeData[geoType] || {};
    const result = await processGeoType(geoType, incomeForGeo, DEFAULT_MORTGAGE_RATE);
    grandTotal += result.records;
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`TOTAL: ${grandTotal} affordable_home_price records stored`);
  console.log(`Completed: ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch(console.error);
