/**
 * Backfill affordable_home_price for all historical periods
 *
 * This script populates affordable_home_price for all period_dates where
 * income_to_buy already exists, ensuring consistent historical data.
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

// Affordable Home Price calculation constants (same as in refresh-calculated-metrics.ts)
const DOWN_PAYMENT_PCT = 0.20;
const MORTGAGE_TERM_MONTHS = 360;
const PROPERTY_TAX_RATE = 0.011;
const INSURANCE_RATE = 0.0035;
const FRONT_END_DTI = 0.28;
const DEFAULT_MORTGAGE_RATE = 0.07;
const BATCH_SIZE = 500;

function calculateAffordableHomePrice(annualIncome: number, mortgageRate: number): number | null {
  if (!annualIncome || annualIncome <= 0) return null;

  const monthlyRate = mortgageRate / 12;
  const factor = Math.pow(1 + monthlyRate, MORTGAGE_TERM_MONTHS);
  const pmtFactor = (monthlyRate * factor) / (factor - 1);
  const maxMonthlyPITI = (annualIncome * FRONT_END_DTI) / 12;
  const taxInsuranceMonthlyRate = (PROPERTY_TAX_RATE + INSURANCE_RATE) / 12;
  const denominator = (1 - DOWN_PAYMENT_PCT) * pmtFactor + taxInsuranceMonthlyRate;

  return Math.round(maxMonthlyPITI / denominator);
}

async function fetchMortgageRate(): Promise<number> {
  try {
    const response = await fetch(
      'https://api.stlouisfed.org/fred/series/observations?series_id=MORTGAGE30US&sort_order=desc&limit=1&api_key=demo&file_type=json'
    );
    const data = await response.json();
    if (data.observations?.[0]?.value) {
      return parseFloat(data.observations[0].value) / 100;
    }
  } catch (e) {
    console.log('Using default mortgage rate');
  }
  return DEFAULT_MORTGAGE_RATE;
}

interface CensusConfig {
  tableName: string;
  geoType: string;
  idField: string;
  nameField: string;
}

const CENSUS_CONFIGS: CensusConfig[] = [
  { tableName: 'census_national', geoType: 'national', idField: 'id', nameField: 'name' },
  { tableName: 'census_state', geoType: 'state', idField: 'state_fips', nameField: 'state_name' },
  { tableName: 'census_metro', geoType: 'metro', idField: 'cbsa_code', nameField: 'cbsa_title' },
  { tableName: 'census_county', geoType: 'county', idField: 'fips_code', nameField: 'county_name' },
  { tableName: 'census_zip', geoType: 'zip', idField: 'zcta', nameField: 'zcta' },
];

async function getIncomeData(config: CensusConfig): Promise<Map<string, { income: number; name: string }>> {
  const incomeMap = new Map<string, { income: number; name: string }>();
  const PAGE_SIZE = 1000;
  let offset = 0;

  while (true) {
    let query;
    if (config.geoType === 'national') {
      query = supabase
        .from(config.tableName)
        .select('year, median_household_income')
        .not('median_household_income', 'is', null)
        .order('year', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
    } else {
      query = supabase
        .from(config.tableName)
        .select(`${config.idField}, ${config.nameField}, year, median_household_income`)
        .not('median_household_income', 'is', null)
        .order('year', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) break;

    for (const row of data) {
      let geoId: string;
      let geoName: string;

      if (config.geoType === 'national') {
        geoId = 'US';
        geoName = 'United States';
      } else {
        geoId = String(row[config.idField]);
        geoName = config.geoType === 'zip' ? `ZIP ${geoId}` : (row[config.nameField] || geoId);
      }

      // Only keep the most recent year's data for each geography
      if (!incomeMap.has(geoId)) {
        incomeMap.set(geoId, { income: Number(row.median_household_income), name: geoName });
      }
    }

    offset += data.length;
    if (data.length < PAGE_SIZE) break;
  }

  return incomeMap;
}

async function getAllPeriodDates(geoType: string): Promise<string[]> {
  const { data } = await supabase
    .from('calculated_metrics')
    .select('period_date')
    .eq('geography_type', geoType)
    .not('income_to_buy', 'is', null)
    .order('period_date', { ascending: true });

  const uniqueDates = [...new Set(data?.map(r => r.period_date) || [])];
  return uniqueDates;
}

async function backfillForGeo(config: CensusConfig, mortgageRate: number): Promise<{ processed: number; stored: number }> {
  console.log(`\nBackfilling ${config.geoType}...`);

  // Get income data
  const incomeData = await getIncomeData(config);
  console.log(`  Found ${incomeData.size} geographies with income data`);

  if (incomeData.size === 0) {
    return { processed: 0, stored: 0 };
  }

  // Get all period dates for this geo type
  const periodDates = await getAllPeriodDates(config.geoType);
  console.log(`  Found ${periodDates.length} period dates to backfill`);

  if (periodDates.length === 0) {
    return { processed: 0, stored: 0 };
  }

  let totalStored = 0;
  const records: any[] = [];

  for (const periodDate of periodDates) {
    for (const [geoId, { income, name }] of incomeData) {
      const affordablePrice = calculateAffordableHomePrice(income, mortgageRate);
      if (affordablePrice === null) continue;

      records.push({
        geography_id: geoId,
        geography_type: config.geoType,
        geography_name: name,
        period_date: periodDate,
        affordable_home_price: affordablePrice,
        calculated_at: new Date().toISOString(),
      });

      if (records.length >= BATCH_SIZE) {
        const { error } = await supabase
          .from('calculated_metrics')
          .upsert(records, { onConflict: 'geography_id,geography_type,period_date' });

        if (error) {
          console.error(`  Error upserting batch: ${error.message}`);
        } else {
          totalStored += records.length;
          process.stdout.write(`\r  Stored ${totalStored.toLocaleString()} records...`);
        }
        records.length = 0;
      }
    }
  }

  // Final batch
  if (records.length > 0) {
    const { error } = await supabase
      .from('calculated_metrics')
      .upsert(records, { onConflict: 'geography_id,geography_type,period_date' });

    if (error) {
      console.error(`  Error upserting final batch: ${error.message}`);
    } else {
      totalStored += records.length;
    }
  }

  console.log(`\n  Completed: ${totalStored.toLocaleString()} records stored`);
  return { processed: incomeData.size * periodDates.length, stored: totalStored };
}

async function main() {
  console.log('='.repeat(60));
  console.log('  Backfill Affordable Home Price for Historical Data');
  console.log('='.repeat(60));

  const mortgageRate = await fetchMortgageRate();
  console.log(`\nUsing mortgage rate: ${(mortgageRate * 100).toFixed(2)}%`);

  const results: Record<string, { processed: number; stored: number }> = {};
  let totalStored = 0;

  for (const config of CENSUS_CONFIGS) {
    const result = await backfillForGeo(config, mortgageRate);
    results[config.geoType] = result;
    totalStored += result.stored;
  }

  console.log('\n' + '='.repeat(60));
  console.log('  SUMMARY');
  console.log('='.repeat(60));

  for (const [geo, result] of Object.entries(results)) {
    console.log(`  ${geo.padEnd(10)}: ${result.stored.toLocaleString()} records`);
  }

  console.log(`\n  Total: ${totalStored.toLocaleString()} records stored`);
}

main().catch(console.error);
