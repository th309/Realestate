/**
 * Run PropertyIQ Scoring System Migrations
 *
 * This script runs the migrations needed for the new scoring system:
 * - 060-create-performance-tracking.sql
 * - 061-propertyiq-scores-normalized.sql
 *
 * Usage:
 *   npx ts-node scripts/run-scoring-migrations.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment
dotenv.config({ path: path.resolve(process.cwd(), 'packages/backend/.env') });

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'scripts/migrations');

const MIGRATIONS_TO_RUN = [
  '060-create-performance-tracking.sql',
  '061-propertyiq-scores-normalized.sql',
];

async function main(): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  PropertyIQ Scoring System - Run Migrations');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  for (const migrationFile of MIGRATIONS_TO_RUN) {
    const filePath = path.join(MIGRATIONS_DIR, migrationFile);

    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  Migration file not found: ${migrationFile}`);
      continue;
    }

    console.log(`📄 Running: ${migrationFile}`);

    const sql = fs.readFileSync(filePath, 'utf8');

    // Split by statement (simple split - may need adjustment for complex SQL)
    const statements = sql
      .split(/;\s*$/m)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let succeeded = 0;
    let failed = 0;

    for (const statement of statements) {
      // Skip empty statements or comments-only
      if (!statement || statement.startsWith('--')) continue;

      try {
        const { error } = await supabase.rpc('exec_sql', { sql_text: statement });

        if (error) {
          // Try using pg_query for DDL statements
          const { error: error2 } = await supabase.from('_migrations').select('*').limit(0);

          // For DDL, we need to use the Supabase Dashboard or supabase CLI
          // The REST API doesn't support arbitrary SQL execution
          console.log(`   ⚠️  Statement may need manual execution (DDL not supported via API)`);
          console.log(`   First 100 chars: ${statement.substring(0, 100)}...`);
          failed++;
        } else {
          succeeded++;
        }
      } catch (err: any) {
        console.log(`   ❌ Error: ${err.message || err}`);
        failed++;
      }
    }

    if (failed > 0) {
      console.log(`   ⚠️  ${succeeded} succeeded, ${failed} need manual execution`);
    } else {
      console.log(`   ✅ ${succeeded} statements executed`);
    }
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('📋 If migrations failed, run them manually in Supabase Dashboard:');
  console.log('   1. Go to https://supabase.com/dashboard');
  console.log('   2. Select your project');
  console.log('   3. Go to SQL Editor');
  console.log('   4. Paste and run each migration file');
  console.log('');
}

main().catch(console.error);
