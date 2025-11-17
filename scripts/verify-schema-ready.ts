/**
 * Verify Schema Ready for CSV Imports
 * 
 * This script verifies that all required columns have been added to the TIGER tables
 * to support CSV imports from normalization files.
 * 
 * Usage:
 *   npx tsx scripts/verify-schema-ready.ts
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

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

interface ColumnCheck {
  table: string;
  column: string;
  dataType: string;
  exists: boolean;
}

interface IndexCheck {
  table: string;
  index: string;
  exists: boolean;
}

async function checkColumn(table: string, column: string): Promise<ColumnCheck> {
  // Use a simpler query approach
  const query = `
    SELECT column_name, data_type, character_maximum_length
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
      AND column_name = $2
  `;

  try {
    // Try using exec_sql RPC
    const { data, error } = await supabase.rpc('exec_sql', {
      query: query.replace('$1', `'${table}'`).replace('$2', `'${column}'`)
    });

    if (!error && data) {
      // Parse result - exec_sql might return different formats
      const result = Array.isArray(data) ? data[0] : data;
      if (result && result.column_name) {
        return {
          table,
          column,
          dataType: result.data_type || '',
          exists: true
        };
      }
    }
  } catch (e) {
    // RPC might not be available, continue to alternative
  }

  // Alternative: Use raw SQL via REST API
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({
        query: `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${table}' AND column_name = '${column}'`
      })
    });

    if (response.ok) {
      const result = await response.json();
      if (result && result.length > 0) {
        return {
          table,
          column,
          dataType: result[0].data_type || '',
          exists: true
        };
      }
    }
  } catch (e) {
    // Fall through
  }

  return { table, column, dataType: '', exists: false };
}

async function checkIndex(table: string, indexName: string): Promise<IndexCheck> {
  try {
    // Try using exec_sql RPC
    const { data, error } = await supabase.rpc('exec_sql', {
      query: `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = '${table}' AND indexname = '${indexName}'`
    });

    if (!error && data) {
      const result = Array.isArray(data) ? data : [data];
      return {
        table,
        index: indexName,
        exists: result.length > 0 && result[0]?.indexname === indexName
      };
    }
  } catch (e) {
    // Continue to alternative
  }

  // Alternative: Use raw SQL via REST API
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({
        query: `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = '${table}' AND indexname = '${indexName}'`
      })
    });

    if (response.ok) {
      const result = await response.json();
      return {
        table,
        index: indexName,
        exists: result && result.length > 0
      };
    }
  } catch (e) {
    // Fall through
  }

  return { table, index: indexName, exists: false };
}

async function verifySchema() {
  console.log('🔍 Verifying schema readiness for CSV imports...\n');
  console.log('📋 Checking required columns and indexes...\n');

  // Define required columns
  const requiredColumns: Array<{ table: string; column: string }> = [
    // tiger_states
    { table: 'tiger_states', column: 'state_abbreviation' },
    { table: 'tiger_states', column: 'population' },
    { table: 'tiger_states', column: 'name_fragment' },
    
    // tiger_counties
    { table: 'tiger_counties', column: 'population' },
    { table: 'tiger_counties', column: 'county_name_fragment' },
    { table: 'tiger_counties', column: 'pct_of_state_population' },
    
    // tiger_cbsa
    { table: 'tiger_cbsa', column: 'population' },
    
    // tiger_zcta
    { table: 'tiger_zcta', column: 'population' },
    { table: 'tiger_zcta', column: 'default_city' },
    { table: 'tiger_zcta', column: 'default_state' },
    { table: 'tiger_zcta', column: 'cbsa_code' },
  ];

  // Define required indexes
  const requiredIndexes: Array<{ table: string; index: string }> = [
    { table: 'tiger_states', index: 'idx_tiger_states_abbreviation' },
    { table: 'tiger_states', index: 'idx_tiger_states_population' },
    { table: 'tiger_counties', index: 'idx_tiger_counties_population' },
    { table: 'tiger_counties', index: 'idx_tiger_counties_state_pop' },
    { table: 'tiger_cbsa', index: 'idx_tiger_cbsa_population' },
    { table: 'tiger_zcta', index: 'idx_tiger_zcta_population' },
    { table: 'tiger_zcta', index: 'idx_tiger_zcta_cbsa_code' },
    { table: 'tiger_zcta', index: 'idx_tiger_zcta_default_state' },
  ];

  // Check columns
  console.log('📊 Checking columns...');
  const columnChecks: ColumnCheck[] = [];
  
  for (const { table, column } of requiredColumns) {
    const check = await checkColumn(table, column);
    columnChecks.push(check);
    
    const status = check.exists ? '✅' : '❌';
    console.log(`   ${status} ${table}.${column}${check.exists ? ` (${check.dataType})` : ''}`);
  }

  console.log('');
  console.log('📊 Checking indexes...');
  const indexChecks: IndexCheck[] = [];
  
  for (const { table, index } of requiredIndexes) {
    const check = await checkIndex(table, index);
    indexChecks.push(check);
    
    const status = check.exists ? '✅' : '❌';
    console.log(`   ${status} ${index} on ${table}`);
  }

  // Summary
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📋 VERIFICATION SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  
  const missingColumns = columnChecks.filter(c => !c.exists);
  const missingIndexes = indexChecks.filter(i => !i.exists);
  
  if (missingColumns.length === 0 && missingIndexes.length === 0) {
    console.log('');
    console.log('✅ Schema is ready for CSV imports!');
    console.log(`   All ${columnChecks.length} required columns exist`);
    console.log(`   All ${indexChecks.length} required indexes exist`);
    console.log('');
    console.log('🚀 You can now proceed with importing CSV files.');
    console.log('');
    process.exit(0);
  } else {
    console.log('');
    console.log('❌ Schema is NOT ready. Missing items:');
    console.log('');
    
    if (missingColumns.length > 0) {
      console.log(`   Missing columns (${missingColumns.length}):`);
      missingColumns.forEach(c => {
        console.log(`      - ${c.table}.${c.column}`);
      });
      console.log('');
    }
    
    if (missingIndexes.length > 0) {
      console.log(`   Missing indexes (${missingIndexes.length}):`);
      missingIndexes.forEach(i => {
        console.log(`      - ${i.index} on ${i.table}`);
      });
      console.log('');
    }
    
    console.log('💡 To fix, run the migration:');
    console.log('   npx tsx scripts/run-migration-003.ts');
    console.log('');
    console.log('   Or execute the SQL file manually:');
    console.log('   scripts/migrations/003-add-geographic-normalization-columns.sql');
    console.log('');
    process.exit(1);
  }
}

// Run verification
verifySchema().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

