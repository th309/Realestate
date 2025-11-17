/**
 * Create Additional Zillow Tables
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
  console.log('🔧 Creating additional Zillow tables...\n');
  
  const sqlFile = join(__dirname, 'migrations/014-create-additional-zillow-tables.sql');
  const sql = readFileSync(sqlFile, 'utf-8');
  
  const { error } = await supabase.rpc('exec_sql', { query: sql });
  
  if (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } else {
    console.log('✅ Additional Zillow tables created!');
    console.log('   - zillow_market_heat_index');
    console.log('   - zillow_new_construction_sales_count');
    console.log('   - zillow_new_construction_sale_price');
    console.log('   - zillow_affordability');
  }
}

run();

