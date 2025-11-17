/**
 * Create Additional Zillow Tables (v2)
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: join(__dirname, '../web/.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function run() {
  console.log('🔧 Creating additional Zillow tables (v2)...\n');
  
  const sqlFile = join(__dirname, 'migrations/015-create-additional-zillow-tables-v2.sql');
  const sql = readFileSync(sqlFile, 'utf-8');
  
  const { error } = await supabase.rpc('exec_sql', { query: sql });
  
  if (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } else {
    console.log('✅ Additional Zillow tables created!');
    console.log('   - zillow_new_listings');
    console.log('   - zillow_newly_pending_listings');
    console.log('   - zillow_list_price');
    console.log('   - zillow_sale_to_list_ratio');
    console.log('   - zillow_sale_list_percent');
    console.log('   - zillow_days_to_close');
    console.log('   - zillow_price_cuts');
    console.log('   - zillow_total_transaction_value');
    console.log('   - Updated zillow_sales_price (added mean_price column)');
  }
}

run();

