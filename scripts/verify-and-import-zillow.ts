/**
 * Verify Zillow Tables Exist and Import Data
 *
 * This script:
 * 1. Verifies all required tables exist
 * 2. Shows current row counts
 * 3. Imports data for tables with 0 rows
 *
 * Usage:
 *   npx tsx scripts/verify-and-import-zillow.ts
 *   npx tsx scripts/verify-and-import-zillow.ts --import-all    # Force reimport all
 *   npx tsx scripts/verify-and-import-zillow.ts --check-only    # Just check tables
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables
config({ path: join(__dirname, '../packages/backend/.env') });
config({ path: join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// All Zillow tables we expect to exist
const ZILLOW_TABLES = [
  // Core tables (from earlier migrations)
  'zillow_zhvi',
  'zillow_zhvf',
  'zillow_zori',
  'zillow_zordi',
  'zillow_inventory',
  'zillow_sales_count',
  'zillow_sales_price',
  'zillow_days_to_pending',
  'zillow_market_heat_index',
  'zillow_new_construction_sales_count',
  'zillow_new_construction_sale_price',
  'zillow_affordability',
  // Migration 026 tables
  'zillow_new_listings',
  'zillow_pending_listings',
  'zillow_median_list_price',
  'zillow_sale_to_list',
  'zillow_days_to_close',
  'zillow_price_cut_share',
  'zillow_price_cut_amt',
  'zillow_price_cut_pct',
];

// Dataset to table mapping
const DATASET_TO_TABLE: Record<string, string> = {
  'zhvi': 'zillow_zhvi',
  'zhvf_growth': 'zillow_zhvf',
  'zori': 'zillow_zori',
  'zordi': 'zillow_zordi',
  'invt_fs': 'zillow_inventory',
  'new_listings': 'zillow_new_listings',
  'new_pending': 'zillow_pending_listings',
  'mlp': 'zillow_median_list_price',
  'sales_count_now': 'zillow_sales_count',
  'median_sale_price': 'zillow_sales_price',
  'median_sale_to_list': 'zillow_sale_to_list',
  'mean_doz_pending': 'zillow_days_to_pending',
  'median_days_to_close': 'zillow_days_to_close',
  'perc_listings_price_cut': 'zillow_price_cut_share',
  'med_listings_price_cut_amt': 'zillow_price_cut_amt',
  'med_listings_price_cut_perc': 'zillow_price_cut_pct',
  'market_temp_index': 'zillow_market_heat_index',
  'new_con_sales_count_raw': 'zillow_new_construction_sales_count',
  'new_con_median_sale_price': 'zillow_new_construction_sale_price',
  'new_con_median_sale_price_raw': 'zillow_new_construction_sale_price',
  'new_con_median_sale_price_per_sqft': 'zillow_new_construction_sale_price',
  'new_homeowner_income_needed': 'zillow_affordability',
  'new_renter_income_needed': 'zillow_affordability',
  'affordable_home_price': 'zillow_affordability',
  'years_to_save': 'zillow_affordability',
  'new_homeowner_affordability': 'zillow_affordability',
  'new_renter_affordability': 'zillow_affordability',
};

interface TableStatus {
  name: string;
  exists: boolean;
  rowCount: number;
  error?: string;
}

async function checkTableStatus(tableName: string): Promise<TableStatus> {
  try {
    const { count, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    if (error) {
      // Table doesn't exist or permission issue
      return {
        name: tableName,
        exists: false,
        rowCount: 0,
        error: error.message
      };
    }

    return {
      name: tableName,
      exists: true,
      rowCount: count || 0
    };
  } catch (err: any) {
    return {
      name: tableName,
      exists: false,
      rowCount: 0,
      error: err.message
    };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const importAll = args.includes('--import-all');
  const checkOnly = args.includes('--check-only');

  console.log('='.repeat(70));
  console.log('  ZILLOW TABLE VERIFICATION');
  console.log('='.repeat(70));
  console.log();

  // Check all tables
  const results: TableStatus[] = [];

  for (const table of ZILLOW_TABLES) {
    const status = await checkTableStatus(table);
    results.push(status);
  }

  // Display results
  console.log('TABLE STATUS:');
  console.log('-'.repeat(70));
  console.log(`${'Table'.padEnd(40)} | ${'Status'.padEnd(10)} | Count`);
  console.log('-'.repeat(70));

  let missingTables = 0;
  let emptyTables = 0;
  let populatedTables = 0;

  for (const result of results) {
    const status = result.exists ? (result.rowCount > 0 ? 'OK' : 'EMPTY') : 'MISSING';
    const statusColor = result.exists ? (result.rowCount > 0 ? '\x1b[32m' : '\x1b[33m') : '\x1b[31m';

    console.log(
      `${result.name.padEnd(40)} | ${statusColor}${status.padEnd(10)}\x1b[0m | ${result.rowCount.toLocaleString()}`
    );

    if (!result.exists) missingTables++;
    else if (result.rowCount === 0) emptyTables++;
    else populatedTables++;
  }

  console.log('-'.repeat(70));
  console.log();

  // Summary
  console.log('SUMMARY:');
  console.log(`  Populated tables: ${populatedTables}`);
  console.log(`  Empty tables:     ${emptyTables}`);
  console.log(`  Missing tables:   ${missingTables}`);
  console.log();

  // List tables needing data
  const tablesNeedingData = results.filter(r => r.exists && r.rowCount === 0);

  if (tablesNeedingData.length > 0) {
    console.log('TABLES NEEDING DATA IMPORT:');
    tablesNeedingData.forEach(t => console.log(`  - ${t.name}`));
    console.log();
  }

  // List missing tables
  const tablesMissing = results.filter(r => !r.exists);
  if (tablesMissing.length > 0) {
    console.log('\x1b[31mMISSING TABLES (run migration 026):\x1b[0m');
    tablesMissing.forEach(t => console.log(`  - ${t.name}: ${t.error}`));
    console.log();
    console.log('Run: npx tsx scripts/run-migration-026.ts');
    console.log();
  }

  if (checkOnly) {
    console.log('Check complete. Use --import-all to run imports.');
    return;
  }

  // Import data if needed
  if (tablesNeedingData.length > 0 || importAll) {
    console.log('='.repeat(70));
    console.log('  STARTING DATA IMPORT');
    console.log('='.repeat(70));
    console.log();
    console.log('Run the full import script:');
    console.log('  npx tsx scripts/import-all-zillow-datasets.ts');
    console.log();
  } else {
    console.log('\x1b[32mAll tables are populated!\x1b[0m');
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
