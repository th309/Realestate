/**
 * Run Migration 051: Create News Cache Table
 *
 * Creates the report_news_cache table for caching Gemini news scout results
 *
 * Usage: npx ts-node scripts/run-migration-051.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('Running Migration 051: Create News Cache Table...\n');

  const sqlPath = path.join(process.cwd(), 'scripts/migrations/051-create-news-cache-table.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  // Execute the migration in sections
  // First, handle DROP and CREATE TABLE
  const createTableMatch = sql.match(/DROP TABLE[\s\S]*?CONSTRAINT unique_geography_cache UNIQUE \(geography_id, geography_type\)\s*\);/);

  if (createTableMatch) {
    console.log('Creating report_news_cache table...');
    const { error } = await supabase.rpc('exec_sql', { sql_query: createTableMatch[0] });
    if (error) {
      console.log('Note: Direct SQL execution not available via RPC.');
      console.log('Please run migration manually in Supabase SQL Editor.\n');
    }
  }

  // Verify the table was created
  console.log('Verifying table creation...');
  const { error: verifyError } = await supabase
    .from('report_news_cache')
    .select('id')
    .limit(1);

  if (verifyError && verifyError.code === '42P01') {
    console.log('\n❌ Table does not exist. Please run migration manually:\n');
    console.log('1. Go to Supabase Dashboard > SQL Editor');
    console.log('2. Copy contents from: scripts/migrations/051-create-news-cache-table.sql');
    console.log('3. Execute the SQL\n');
    console.log('Migration file location:');
    console.log(`   ${sqlPath}\n`);
  } else if (verifyError) {
    console.log(`Verification error: ${verifyError.message}`);
  } else {
    console.log('✅ report_news_cache table exists and is accessible!\n');
  }
}

runMigration().catch(console.error);
