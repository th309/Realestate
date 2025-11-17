/**
 * Run migration 003: Add Geographic Normalization Columns
 * 
 * This script executes the SQL migration to add columns to TIGER tables
 * for supporting CSV imports from normalization files.
 * 
 * Usage:
 *   npx tsx scripts/run-migration-003.ts
 * 
 * Or with explicit env vars:
 *   SUPABASE_URL=https://... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/run-migration-003.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables from web/.env.local
config({ path: join(__dirname, '../web/.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing Supabase credentials');
  console.error('   Required: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL');
  console.error('   Required: SUPABASE_SERVICE_ROLE_KEY');
  console.error('');
  console.error('   Please set these in web/.env.local or as environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  console.log('📄 Reading migration file...');
  const migrationFile = join(__dirname, 'migrations/003-add-geographic-normalization-columns.sql');
  const sql = readFileSync(migrationFile, 'utf-8');

  // Remove comments and split into statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => {
      // Remove empty statements and comments
      const cleaned = s.replace(/--.*$/gm, '').trim();
      return cleaned.length > 0 && !cleaned.match(/^\/\*/);
    });

  console.log(`   Found ${statements.length} SQL statements to execute`);
  console.log('');

  console.log('🔌 Connecting to Supabase...');
  console.log(`   URL: ${supabaseUrl}`);
  console.log('');

  // Execute each statement
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (!statement) continue;

    // Skip verification queries (commented out)
    if (statement.includes('SELECT column_name') || statement.includes('SELECT indexname')) {
      continue;
    }

    console.log(`📝 Executing statement ${i + 1}/${statements.length}...`);
    
    try {
      // Use RPC function if available, otherwise use direct query
      const { error } = await supabase.rpc('exec_sql', { query: statement });

      if (error) {
        // If exec_sql doesn't exist, try direct SQL execution via REST API
        console.log('   ⚠️  RPC exec_sql not available, trying direct execution...');
        
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({ query: statement })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
      }

      console.log(`   ✅ Statement ${i + 1} executed successfully`);
    } catch (error: any) {
      console.error(`   ❌ Error executing statement ${i + 1}:`);
      console.error(`      ${error.message}`);
      console.error('');
      console.error('   Statement:');
      console.error(`      ${statement.substring(0, 200)}...`);
      console.error('');
      console.error('   Migration failed. Please check the error above.');
      process.exit(1);
    }
  }

  console.log('');
  console.log('✅ Migration completed successfully!');
  console.log('');
  console.log('📊 Verification:');
  console.log('   Run these queries to verify the columns were added:');
  console.log('');
  console.log('   SELECT column_name, data_type FROM information_schema.columns');
  console.log('   WHERE table_name = \'tiger_states\' AND column_name IN (\'state_abbreviation\', \'population\', \'name_fragment\');');
  console.log('');
  console.log('   SELECT column_name, data_type FROM information_schema.columns');
  console.log('   WHERE table_name = \'tiger_counties\' AND column_name IN (\'population\', \'county_name_fragment\', \'pct_of_state_population\');');
  console.log('');
  console.log('   SELECT column_name, data_type FROM information_schema.columns');
  console.log('   WHERE table_name = \'tiger_cbsa\' AND column_name = \'population\';');
  console.log('');
  console.log('   SELECT column_name, data_type FROM information_schema.columns');
  console.log('   WHERE table_name = \'tiger_zcta\' AND column_name IN (\'population\', \'default_city\', \'default_state\', \'cbsa_code\');');
}

runMigration().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

