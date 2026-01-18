/**
 * Diagnostic script to check time series data availability
 * Run with: npx tsx scripts/check-timeseries-data.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Check .env.local file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable(tableName: string, columns: string[], filterColumn?: string, filterValue?: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Table: ${tableName}`);
  console.log('='.repeat(60));

  try {
    // Count total rows
    let countQuery = supabase.from(tableName).select('*', { count: 'exact', head: true });
    const { count: totalCount, error: countError } = await countQuery;

    if (countError) {
      console.log(`  ❌ Error: ${countError.message}`);
      return;
    }

    console.log(`  Total rows: ${totalCount || 0}`);

    if ((totalCount || 0) === 0) {
      console.log(`  ⚠️  NO DATA in this table`);
      return;
    }

    // Get sample data
    let sampleQuery = supabase.from(tableName).select(columns.join(',')).limit(3);
    if (filterColumn && filterValue) {
      sampleQuery = sampleQuery.eq(filterColumn, filterValue);
    }

    const { data: sampleData, error: sampleError } = await sampleQuery;

    if (sampleError) {
      console.log(`  ❌ Sample error: ${sampleError.message}`);
      return;
    }

    console.log(`  Sample data${filterColumn ? ` (filtered by ${filterColumn}='${filterValue}')` : ''}:`);
    sampleData?.forEach((row, i) => {
      console.log(`    [${i + 1}] ${JSON.stringify(row)}`);
    });

    // Get date range
    const dateColumn = tableName.startsWith('census_') ? 'year' : 'period_date';
    const { data: dateRange } = await supabase
      .from(tableName)
      .select(dateColumn)
      .order(dateColumn, { ascending: false })
      .limit(1);

    if (dateRange?.[0]) {
      console.log(`  Latest ${dateColumn}: ${dateRange[0][dateColumn]}`);
    }

    // Get distinct values for key filter columns
    if (filterColumn) {
      const { data: distinctValues } = await supabase
        .from(tableName)
        .select(filterColumn)
        .limit(100);

      const unique = [...new Set(distinctValues?.map(r => r[filterColumn]).filter(Boolean))].slice(0, 10);
      console.log(`  Sample ${filterColumn} values: ${unique.join(', ')}${unique.length >= 10 ? '...' : ''}`);
    }

  } catch (err) {
    console.log(`  ❌ Exception: ${err}`);
  }
}

async function main() {
  console.log('🔍 Time Series Data Diagnostic');
  console.log('Checking database tables for data availability...\n');

  // Check Realtor tables
  await checkTable('realtor_national', ['period_date', 'country', 'median_listing_price']);
  await checkTable('realtor_state', ['period_date', 'state_name', 'state_id', 'median_listing_price'], 'state_name', 'Florida');
  await checkTable('realtor_metro', ['period_date', 'cbsa_code', 'cbsa_title', 'median_listing_price'], 'cbsa_code', '33100');
  await checkTable('realtor_county', ['period_date', 'county_fips', 'county_name', 'median_listing_price'], 'county_fips', '12086');
  await checkTable('realtor_zip', ['period_date', 'postal_code', 'zip_name', 'median_listing_price'], 'postal_code', '33139');

  // Check Zillow tables
  await checkTable('zillow_state', ['period_date', 'region_name', 'metric_name', 'value'], 'region_name', 'Florida');
  await checkTable('zillow_metro', ['period_date', 'cbsa_code', 'region_name', 'metric_name', 'value'], 'cbsa_code', '33100');
  await checkTable('zillow_county', ['period_date', 'fips_code', 'region_name', 'metric_name', 'value']);
  await checkTable('zillow_zip', ['period_date', 'region_name', 'metric_name', 'value'], 'region_name', '33139');

  // Check Census tables
  await checkTable('census_state', ['year', 'state_name', 'total_population', 'median_household_income'], 'state_name', 'Florida');
  await checkTable('census_metro', ['year', 'cbsa_code', 'cbsa_title', 'total_population'], 'cbsa_code', '33100');

  // Check Economic tables
  await checkTable('economic_state', ['period_date', 'state_name', 'unemployment_rate'], 'state_name', 'Florida');
  await checkTable('economic_metro', ['period_date', 'cbsa_code', 'cbsa_title', 'unemployment_rate'], 'cbsa_code', '33100');

  console.log('\n' + '='.repeat(60));
  console.log('✅ Diagnostic complete');
  console.log('='.repeat(60));
}

main().catch(console.error);
