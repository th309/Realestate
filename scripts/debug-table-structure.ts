/**
 * Debug Table Structure
 * Check actual columns in the zillow tables
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../packages/backend/.env') });
config({ path: join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function main() {
  console.log('Checking table structures...\n');

  // Tables to check
  const tables = [
    'zillow_new_listings',
    'zillow_pending_listings',
    'zillow_median_list_price',
    'zillow_sale_to_list',
    'zillow_days_to_close',
    'zillow_price_cut_share',
    'zillow_price_cut_amt',
    'zillow_price_cut_pct',
  ];

  for (const table of tables) {
    console.log(`\n=== ${table} ===`);

    // Try to get column info using information_schema
    const { data, error } = await supabase
      .rpc('get_table_columns', { table_name: table })
      .single();

    if (error) {
      // Fallback: just try to select and see what columns are returned
      const { data: selectData, error: selectError } = await supabase
        .from(table)
        .select('*')
        .limit(0);

      if (selectError) {
        console.log(`  Error: ${selectError.message}`);
      } else {
        console.log(`  Table exists (no columns returned on empty table)`);
      }
    } else {
      console.log(`  Columns: ${JSON.stringify(data)}`);
    }
  }

  // Alternative: Check schema via raw SQL
  console.log('\n\n=== Checking via raw query ===');
  const { data: schemaData, error: schemaError } = await supabase
    .from('zillow_zhvi')
    .select('*')
    .limit(1);

  if (schemaData && schemaData.length > 0) {
    console.log('\nzillow_zhvi columns (working table):');
    console.log(Object.keys(schemaData[0]));
  }

  // Check new_listings specifically
  console.log('\n=== Direct check on zillow_new_listings ===');

  // Try to select specific columns
  const columns = ['id', 'region_id', 'date', 'value', 'property_type', 'geography'];
  for (const col of columns) {
    const { error } = await supabase
      .from('zillow_new_listings')
      .select(col)
      .limit(1);

    if (error) {
      console.log(`  ${col}: NOT FOUND - ${error.message}`);
    } else {
      console.log(`  ${col}: EXISTS`);
    }
  }
}

main().catch(console.error);
