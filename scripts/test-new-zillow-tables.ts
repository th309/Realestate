/**
 * Test New Zillow Tables
 * Verifies data is accessible via the service layer
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../packages/backend/.env') });
config({ path: join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

interface TestResult {
  endpoint: string;
  table: string;
  success: boolean;
  count: number;
  sample?: any;
  error?: string;
}

async function testTable(table: string, endpoint: string): Promise<TestResult> {
  try {
    const { data, error, count } = await supabase
      .from(table)
      .select('*', { count: 'exact' })
      .eq('geography', 'Metro')
      .order('date', { ascending: false })
      .limit(1);

    if (error) {
      return { endpoint, table, success: false, count: 0, error: error.message };
    }

    return {
      endpoint,
      table,
      success: true,
      count: count || 0,
      sample: data?.[0]
    };
  } catch (err: any) {
    return { endpoint, table, success: false, count: 0, error: err.message };
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('  ZILLOW NEW TABLES TEST');
  console.log('='.repeat(70));
  console.log();

  const tests = [
    { table: 'zillow_new_listings', endpoint: 'GET /api/zillow/new-listings/metros' },
    { table: 'zillow_pending_listings', endpoint: 'GET /api/zillow/pending-listings/metros' },
    { table: 'zillow_median_list_price', endpoint: 'GET /api/zillow/list-price/metros' },
    { table: 'zillow_sale_to_list', endpoint: 'GET /api/zillow/sale-to-list/metros' },
    { table: 'zillow_days_to_close', endpoint: 'GET /api/zillow/days-to-close/metros' },
    { table: 'zillow_price_cut_share', endpoint: 'GET /api/zillow/price-cuts/metros (share)' },
    { table: 'zillow_price_cut_amt', endpoint: 'GET /api/zillow/price-cuts/metros (amount)' },
    { table: 'zillow_price_cut_pct', endpoint: 'GET /api/zillow/price-cuts/metros (percent)' },
  ];

  const results: TestResult[] = [];

  for (const test of tests) {
    const result = await testTable(test.table, test.endpoint);
    results.push(result);
  }

  // Display results
  console.log('RESULTS:');
  console.log('-'.repeat(70));

  for (const result of results) {
    const status = result.success ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
    console.log(`${status} ${result.endpoint}`);
    console.log(`   Table: ${result.table}`);
    console.log(`   Records: ${result.count.toLocaleString()}`);

    if (result.sample) {
      console.log(`   Latest date: ${result.sample.date}`);
      console.log(`   Sample value: ${result.sample.value}`);
    }

    if (result.error) {
      console.log(`   \x1b[31mError: ${result.error}\x1b[0m`);
    }
    console.log();
  }

  // Summary
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log('-'.repeat(70));
  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log('\n\x1b[32mAll API endpoints have data and are ready to use!\x1b[0m');
  }
}

main().catch(console.error);
