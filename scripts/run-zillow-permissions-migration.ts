/**
 * Execute Zillow Import Permissions Migration
 * 
 * Usage:
 *   npx tsx scripts/run-zillow-permissions-migration.ts
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
  console.log('🔧 Granting Zillow import permissions...\n');
  
  // Read SQL file
  const sqlFile = join(__dirname, 'migrations/010-grant-zillow-import-permissions.sql');
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
    
    console.log('✅ Permissions granted successfully!\n');
    console.log('The following permissions have been granted:');
    console.log('  - markets: SELECT, INSERT, UPDATE for service_role');
    console.log('  - market_time_series: SELECT, INSERT, UPDATE for service_role');
    console.log('  - data_ingestion_logs: SELECT, INSERT, UPDATE for service_role');
    console.log('  - RLS disabled on all tables');
    
  } catch (error: any) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

runMigration();

