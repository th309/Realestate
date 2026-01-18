/**
 * Run migration 050: PropertyIQ Reports System Enhancements
 *
 * This migration adds:
 * - report_templates table
 * - saved_insights table
 * - New columns to reports, report_conversations, user_report_memory
 * - user_reports_view
 *
 * Usage: npx ts-node scripts/run-migration-050.ts
 *
 * Note: If exec_sql RPC is not available, copy the migration SQL
 * and run it directly in the Supabase SQL Editor.
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('Running migration 050: PropertyIQ Reports System Enhancements...\n');

  const migrationPath = path.join(__dirname, 'migrations', '050-create-report-tables.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  try {
    const { error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      console.log('RPC exec_sql not available.');
      console.log('\nPlease run the migration SQL directly in Supabase SQL Editor:');
      console.log(migrationPath);
      console.log('\nMigration file location:', migrationPath);
    } else {
      console.log('Migration 050 completed successfully!');
    }
  } catch (err) {
    console.error('Migration failed:', err);
    console.log('\nPlease run the migration SQL directly in Supabase SQL Editor.');
    console.log('File:', migrationPath);
  }
}

runMigration();
