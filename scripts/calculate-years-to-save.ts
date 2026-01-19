/**
 * Calculate Years to Save metric for all geographies
 *
 * Formula: (Median listing price × 0.20) / (Median Income × 0.10)
 * - 20% down payment
 * - 10% savings rate
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const SAVINGS_RATE = 0.10; // 10% savings rate
const DOWN_PAYMENT_RATE = 0.20; // 20% down payment
const BATCH_SIZE = 500;

interface RealtorConfig {
  tableName: string;
  geoType: string;
  idField: string;
  nameField: string;
}

const REALTOR_CONFIGS: RealtorConfig[] = [
  { tableName: 'realtor_national', geoType: 'national', idField: 'country', nameField: 'country' },
  { tableName: 'realtor_state', geoType: 'state', idField: 'state_id', nameField: 'state_name' },
  { tableName: 'realtor_metro', geoType: 'metro', idField: 'cbsa_code', nameField: 'cbsa_title' },
  { tableName: 'realtor_county', geoType: 'county', idField: 'county_fips', nameField: 'county_name' },
  { tableName: 'realtor_zip', geoType: 'zip', idField: 'postal_code', nameField: 'postal_code' },
];

// Census table mapping for income lookup
const CENSUS_TABLE_MAP: Record<string, { tableName: string; idField: string }> = {
  national: { tableName: 'census_national', idField: 'id' },
  state: { tableName: 'census_state', idField: 'state_fips' },
  metro: { tableName: 'census_metro', idField: 'cbsa_code' },
  county: { tableName: 'census_county', idField: 'fips_code' },
  zip: { tableName: 'census_zip', idField: 'zcta' },
};

// State FIPS to abbreviation mapping for state-level lookups
const STATE_FIPS_MAP: Record<string, string> = {
  'AL': '01', 'AK': '02', 'AZ': '04', 'AR': '05', 'CA': '06',
  'CO': '08', 'CT': '09', 'DE': '10', 'DC': '11', 'FL': '12',
  'GA': '13', 'HI': '15', 'ID': '16', 'IL': '17', 'IN': '18',
  'IA': '19', 'KS': '20', 'KY': '21', 'LA': '22', 'ME': '23',
  'MD': '24', 'MA': '25', 'MI': '26', 'MN': '27', 'MS': '28',
  'MO': '29', 'MT': '30', 'NE': '31', 'NV': '32', 'NH': '33',
  'NJ': '34', 'NM': '35', 'NY': '36', 'NC': '37', 'ND': '38',
  'OH': '39', 'OK': '40', 'OR': '41', 'PA': '42', 'RI': '44',
  'SC': '45', 'SD': '46', 'TN': '47', 'TX': '48', 'UT': '49',
  'VT': '50', 'VA': '51', 'WA': '53', 'WV': '54', 'WI': '55',
  'WY': '56', 'PR': '72',
};

function calculateYearsToSave(price: number, income: number): number | null {
  if (!price || price === 0 || !income || income === 0) return null;

  const downPayment = price * DOWN_PAYMENT_RATE;
  const annualSavings = income * SAVINGS_RATE;
  const years = downPayment / annualSavings;

  return Math.round(years * 10) / 10; // Round to 1 decimal place
}

async function calculateYearsToSaveForGeo(
  config: RealtorConfig
): Promise<{ processed: number; stored: number; errors: string[] }> {
  const errors: string[] = [];
  const censusConfig = CENSUS_TABLE_MAP[config.geoType];

  console.log(`\nCalculating years_to_save for ${config.geoType}...`);

  // Get latest Realtor data with median_listing_price
  const { data: latestDateRow } = await supabase
    .from(config.tableName)
    .select('period_date')
    .not('median_listing_price', 'is', null)
    .order('period_date', { ascending: false })
    .limit(1)
    .single();

  if (!latestDateRow?.period_date) {
    console.log(`  No listing price data for ${config.geoType}`);
    return { processed: 0, stored: 0, errors: [`No listing price data for ${config.geoType}`] };
  }

  const targetDate = latestDateRow.period_date;
  console.log(`  Target date: ${targetDate}`);

  // Fetch Realtor listing prices (paginated)
  const PAGE_SIZE = 1000;
  let realtorData: any[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from(config.tableName)
      .select(`${config.idField}, ${config.nameField}, median_listing_price`)
      .eq('period_date', targetDate)
      .not('median_listing_price', 'is', null)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      errors.push(error.message);
      break;
    }
    if (!data || data.length === 0) break;
    realtorData = realtorData.concat(data);
    if (data.length < PAGE_SIZE) break;
    offset += data.length;
  }

  console.log(`  Found ${realtorData.length} records with listing prices`);

  if (realtorData.length === 0) {
    return { processed: 0, stored: 0, errors: [`No Realtor data for ${config.geoType}`] };
  }

  // Fetch Census income data (latest year per geography)
  const incomeByGeo: Record<string, number> = {};
  offset = 0;

  while (true) {
    let query;
    if (config.geoType === 'national') {
      query = supabase
        .from(censusConfig.tableName)
        .select('year, median_household_income')
        .not('median_household_income', 'is', null)
        .order('year', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
    } else {
      query = supabase
        .from(censusConfig.tableName)
        .select(`${censusConfig.idField}, year, median_household_income`)
        .not('median_household_income', 'is', null)
        .order('year', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
    }

    const { data, error } = await query;
    if (error) {
      errors.push(error.message);
      break;
    }
    if (!data || data.length === 0) break;

    for (const row of data) {
      let geoId: string;
      if (config.geoType === 'national') {
        geoId = 'US';
      } else {
        geoId = String(row[censusConfig.idField]);
      }
      // Keep only the most recent year's data
      if (!incomeByGeo[geoId]) {
        incomeByGeo[geoId] = Number(row.median_household_income);
      }
    }

    offset += data.length;
    if (data.length < PAGE_SIZE) break;
  }

  console.log(`  Found ${Object.keys(incomeByGeo).length} geographies with income data`);

  // Calculate years_to_save for each geography
  let stored = 0;
  const records: any[] = [];

  for (const row of realtorData) {
    let geoId: string;
    let geoName: string;
    let incomeGeoId: string;

    if (config.geoType === 'national') {
      geoId = 'US';
      geoName = 'United States';
      incomeGeoId = 'US';
    } else if (config.geoType === 'state') {
      // State ID mapping: realtor uses state_id (e.g., "CA"), census uses state_fips (e.g., "06")
      geoId = row[config.idField];
      geoName = row[config.nameField];
      incomeGeoId = STATE_FIPS_MAP[geoId] || geoId;
    } else if (config.geoType === 'zip') {
      geoId = row[config.idField];
      geoName = `ZIP ${geoId}`;
      incomeGeoId = geoId;
    } else {
      geoId = row[config.idField];
      geoName = row[config.nameField] || geoId;
      incomeGeoId = geoId;
    }

    const price = row.median_listing_price;
    const income = incomeByGeo[incomeGeoId];

    if (!income) continue;

    const yearsToSave = calculateYearsToSave(price, income);
    if (yearsToSave === null) continue;

    records.push({
      geography_id: geoId,
      geography_type: config.geoType,
      geography_name: geoName,
      period_date: targetDate,
      years_to_save: yearsToSave,
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

  // Final batch
  if (records.length > 0) {
    const { error: upsertError } = await supabase
      .from('calculated_metrics')
      .upsert(records, { onConflict: 'geography_id,geography_type,period_date' });
    if (upsertError) errors.push(upsertError.message);
    else stored += records.length;
  }

  console.log(`  ✓ Stored ${stored} records`);
  return { processed: realtorData.length, stored, errors };
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('         CALCULATE YEARS TO SAVE METRIC');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Formula: (Price × ${DOWN_PAYMENT_RATE * 100}%) / (Income × ${SAVINGS_RATE * 100}%)`);

  const results: Record<string, { processed: number; stored: number; errors: string[] }> = {};
  let totalStored = 0;

  for (const config of REALTOR_CONFIGS) {
    const result = await calculateYearsToSaveForGeo(config);
    results[config.geoType] = result;
    totalStored += result.stored;
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('                       SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');

  for (const [geo, result] of Object.entries(results)) {
    console.log(`  ${geo.padEnd(10)}: ${result.stored} records`);
    if (result.errors.length > 0) {
      console.log(`    Errors: ${result.errors.slice(0, 2).join(', ')}`);
    }
  }

  console.log(`\n  Total: ${totalStored} records stored`);
  console.log('═══════════════════════════════════════════════════════════════');

  // Verify data
  console.log('\n📋 Verifying stored data...');

  const { data: sampleData } = await supabase
    .from('calculated_metrics')
    .select('geography_type, geography_name, years_to_save')
    .not('years_to_save', 'is', null)
    .order('geography_type')
    .limit(10);

  if (sampleData && sampleData.length > 0) {
    console.log('\nSample years_to_save data:');
    for (const row of sampleData) {
      console.log(`  ${row.geography_type.padEnd(8)} | ${row.geography_name?.substring(0, 30).padEnd(30)} | ${row.years_to_save} years`);
    }
  }

  const { count } = await supabase
    .from('calculated_metrics')
    .select('*', { count: 'exact', head: true })
    .not('years_to_save', 'is', null);

  console.log(`\n✓ Total records with years_to_save: ${count}`);
}

main().catch(console.error);
