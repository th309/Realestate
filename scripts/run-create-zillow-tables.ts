/**
 * Create Zillow-Specific Tables
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
  console.log('🔧 Creating Zillow-specific tables...\n');
  
  const sqlFile = join(__dirname, 'migrations/013-create-zillow-specific-tables.sql');
  const sql = readFileSync(sqlFile, 'utf-8');
  
  const { error } = await supabase.rpc('exec_sql', { query: sql });
  
  if (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } else {
    console.log('✅ Zillow-specific tables created!');
    console.log('   - zillow_zhvi (Home Values)');
    console.log('   - zillow_zori (Rentals)');
    console.log('   - zillow_inventory (For-Sale Inventory)');
    console.log('   - zillow_sales_count (Sales Count)');
    console.log('   - zillow_sales_price (Median Sale Price)');
    console.log('   - zillow_days_to_pending (Days to Pending)');
  }
}

run();

