/**
 * Execute Create market_time_series Table Migration
 * 
 * Usage:
 *   npx tsx scripts/run-create-time-series-table.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config({ path: join(__dirname, '../web/.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('   Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  console.error('   Set them in web/.env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  console.log('🔧 Creating market_time_series table...\n');
  
  // Read SQL file
  const sqlFile = join(__dirname, 'migrations/011-create-market-time-series-table.sql');
  const sql = readFileSync(sqlFile, 'utf-8');
  
  try {
    // Execute using exec_sql RPC function
    const { data, error } = await supabase.rpc('exec_sql', { query: sql });
    
    if (error) {
      console.error('❌ Error executing migration:', error.message);
      console.error('   Code:', error.code);
      console.error('   Details:', error.details);
      process.exit(1);
    }
    
    console.log('✅ Table created successfully!\n');
    console.log('The market_time_series table has been created with:');
    console.log('  - Primary key on (id, date)');
    console.log('  - Foreign key to markets(region_id)');
    console.log('  - Indexes for efficient queries');
    console.log('  - Unique constraint for upsert operations');
    console.log('  - Permissions granted to service_role');
    
  } catch (error: any) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

runMigration();

