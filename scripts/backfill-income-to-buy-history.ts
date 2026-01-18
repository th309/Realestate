/**
 * Backfill Income-to-Buy Historical Data
 *
 * Calculates income_to_buy for all historical months where we have Realtor price data.
 * This allows tracking the metric over time.
 *
 * Usage: npx tsx scripts/backfill-income-to-buy-history.ts
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Constants (same as refresh utility)
const DOWN_PAYMENT_PCT = 0.20;
const DEFAULT_MORTGAGE_RATE = 0.07;
const MORTGAGE_TERM_MONTHS = 360;
const PROPERTY_TAX_RATE = 0.011;
const INSURANCE_RATE = 0.0035;
const FRONT_END_DTI = 0.28;
const BATCH_SIZE = 100;
const PAGE_SIZE = 1000;

function calculateIncomeToBuy(price: number, mortgageRate: number): number | null {
  if (!price || price === 0) return null;

  const loanAmount = price * (1 - DOWN_PAYMENT_PCT);
  const monthlyRate = mortgageRate / 12;
  const factor = Math.pow(1 + monthlyRate, MORTGAGE_TERM_MONTHS);
  const monthlyMortgage = loanAmount * (monthlyRate * factor) / (factor - 1);
  const monthlyTaxes = (price * PROPERTY_TAX_RATE) / 12;
  const monthlyInsurance = (price * INSURANCE_RATE) / 12;
  const monthlyPITI = monthlyMortgage + monthlyTaxes + monthlyInsurance;
  const annualIncome = (monthlyPITI * 12) / FRONT_END_DTI;

  return Math.round(annualIncome);
}

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

async function getUniqueDates(tableName: string): Promise<string[]> {
  const dates: string[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data } = await supabase
      .from(tableName)
      .select('period_date')
      .not('median_listing_price', 'is', null)
      .order('period_date', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (data && data.length > 0) {
      for (const row of data) {
        if (!dates.includes(row.period_date)) {
          dates.push(row.period_date);
        }
      }
      offset += data.length;
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }

  return dates.sort();
}

async function backfillForGeoAndDate(
  config: GeoConfig,
  targetDate: string,
  mortgageRate: number
): Promise<{ stored: number }> {
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

    if (error || !data || data.length === 0) {
      hasMore = false;
    } else {
      allData = allData.concat(data);
      offset += data.length;
      hasMore = data.length === PAGE_SIZE;
    }
  }

  if (allData.length === 0) return { stored: 0 };

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
      if (!upsertError) stored += records.length;
      records.length = 0;
    }
  }

  if (records.length > 0) {
    const { error: upsertError } = await supabase
      .from('calculated_metrics')
      .upsert(records, { onConflict: 'geography_id,geography_type,period_date' });
    if (!upsertError) stored += records.length;
  }

  return { stored };
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('         BACKFILL INCOME-TO-BUY HISTORICAL DATA');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Started: ${new Date().toISOString()}\n`);

  const mortgageRate = DEFAULT_MORTGAGE_RATE;
  console.log(`Using mortgage rate: ${(mortgageRate * 100).toFixed(2)}%\n`);

  let totalStored = 0;

  for (const config of GEO_CONFIGS) {
    console.log(`\n📊 Processing ${config.geoType}...`);

    // Get all unique dates for this table
    const dates = await getUniqueDates(config.tableName);
    console.log(`   Found ${dates.length} months of data`);

    if (dates.length === 0) continue;

    let geoStored = 0;
    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];
      const result = await backfillForGeoAndDate(config, date, mortgageRate);
      geoStored += result.stored;

      // Progress indicator
      if ((i + 1) % 10 === 0 || i === dates.length - 1) {
        process.stdout.write(`\r   Processing: ${i + 1}/${dates.length} months, ${geoStored} records stored`);
      }
    }

    console.log(`\n   ✓ ${config.geoType}: ${geoStored} total records stored across ${dates.length} months`);
    totalStored += geoStored;
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`TOTAL: ${totalStored} income_to_buy records stored`);
  console.log(`Completed: ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
