/**
 * Run Migration 026 - Create Additional Zillow Market Tables
 *
 * This creates tables for:
 * - New Listings, Pending Listings, Median List Price
 * - Sale-to-List Ratio, Days to Close
 * - Price Cut metrics (share, amount, percent)
 * - Data Ingestion Log and Data Source Registry
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Try multiple locations for env files
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
dotenv.config({ path: path.join(__dirname, '..', 'packages', 'frontend', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:');
  console.error('- NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL');
  console.error('- SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('='.repeat(60));
  console.log('Running Migration 026: Create Additional Zillow Market Tables');
  console.log('='.repeat(60));

  const migrationPath = path.join(__dirname, 'migrations', '026-create-additional-zillow-market-tables.sql');

  if (!fs.existsSync(migrationPath)) {
    console.error(`Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf-8');

  // Split by semicolons but handle functions that contain semicolons
  const statements = splitSqlStatements(sql);

  console.log(`Found ${statements.length} SQL statements to execute`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i].trim();
    if (!stmt || stmt.startsWith('--')) continue;

    try {
      const { error } = await supabase.rpc('exec_sql', { sql: stmt });

      if (error) {
        // Try direct execution for certain statements
        const { error: directError } = await supabase.from('_migrations').select('*').limit(0);
        if (directError && directError.code === 'PGRST116') {
          // Table doesn't exist, which is fine for some checks
        }
        console.warn(`Statement ${i + 1}: ${error.message?.substring(0, 100)}`);
        errorCount++;
      } else {
        successCount++;
      }
    } catch (e: any) {
      console.warn(`Statement ${i + 1} exception: ${e.message?.substring(0, 100)}`);
      errorCount++;
    }

    // Progress indicator
    if (i % 10 === 0) {
      process.stdout.write('.');
    }
  }

  console.log('\n');
  console.log('='.repeat(60));
  console.log('Migration Complete');
  console.log(`Success: ${successCount} statements`);
  console.log(`Errors: ${errorCount} statements`);
  console.log('='.repeat(60));

  // Verify tables were created
  console.log('\nVerifying tables...');
  const tablesToVerify = [
    'zillow_new_listings',
    'zillow_pending_listings',
    'zillow_median_list_price',
    'zillow_sale_to_list',
    'zillow_days_to_close',
    'zillow_price_cut_share',
    'zillow_price_cut_amt',
    'zillow_price_cut_pct',
    'data_ingestion_log',
    'data_source_registry'
  ];

  for (const table of tablesToVerify) {
    const { error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`  [X] ${table}: ${error.message}`);
    } else {
      console.log(`  [✓] ${table}: exists`);
    }
  }
}

function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inFunction = false;
  let dollarQuote = '';

  const lines = sql.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and pure comments
    if (!trimmed || trimmed.startsWith('--')) {
      current += line + '\n';
      continue;
    }

    // Check for dollar-quoted strings (used in functions)
    if (!inFunction && trimmed.includes('$$')) {
      inFunction = true;
      dollarQuote = '$$';
    } else if (inFunction && trimmed.includes('$$')) {
      const count = (trimmed.match(/\$\$/g) || []).length;
      if (count >= 2 || (count === 1 && current.includes('$$'))) {
        inFunction = false;
      }
    }

    current += line + '\n';

    // If we're not in a function and line ends with semicolon, it's end of statement
    if (!inFunction && trimmed.endsWith(';')) {
      statements.push(current.trim());
      current = '';
    }
  }

  // Add any remaining content
  if (current.trim()) {
    statements.push(current.trim());
  }

  return statements.filter(s => s && !s.match(/^--.*$/));
}

runMigration()
  .then(() => {
    console.log('\nMigration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
