/**
 * Apply HUD FMR Migration
 *
 * Creates the hud_fmr table in Supabase.
 * Run this once before importing HUD FMR data.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  console.log('Applying HUD FMR migration...\n');

  // Check if table already exists
  const { data: existingTable, error: checkError } = await supabase
    .from('hud_fmr')
    .select('id')
    .limit(1);

  if (!checkError) {
    console.log('✓ Table hud_fmr already exists');

    // Count existing records
    const { count } = await supabase
      .from('hud_fmr')
      .select('*', { count: 'exact', head: true });

    console.log(`  Current record count: ${count || 0}`);
    return;
  }

  // Table doesn't exist, create it using raw SQL via RPC
  // Since Supabase JS doesn't support raw DDL, we'll use the REST API
  console.log('Table does not exist. Please run the following SQL in Supabase SQL Editor:\n');

  const sql = `
-- Create HUD Fair Market Rent table
CREATE TABLE IF NOT EXISTS hud_fmr (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  fips_code VARCHAR(5) NOT NULL,
  county_name VARCHAR(100),
  state_fips VARCHAR(2),
  state_name VARCHAR(50),
  metro_code VARCHAR(10),
  metro_name VARCHAR(200),
  fmr_0br INTEGER,
  fmr_1br INTEGER,
  fmr_2br INTEGER,
  fmr_3br INTEGER,
  fmr_4br INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(year, fips_code)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hud_fmr_fips ON hud_fmr(fips_code);
CREATE INDEX IF NOT EXISTS idx_hud_fmr_year ON hud_fmr(year DESC);
CREATE INDEX IF NOT EXISTS idx_hud_fmr_year_fips ON hud_fmr(year, fips_code);
CREATE INDEX IF NOT EXISTS idx_hud_fmr_state ON hud_fmr(state_fips);

-- Permissions
GRANT ALL ON hud_fmr TO service_role;
GRANT SELECT ON hud_fmr TO anon;
GRANT SELECT ON hud_fmr TO authenticated;
  `;

  console.log(sql);
  console.log('\n---\nAfter running the SQL, re-run this script to verify.\n');
}

applyMigration().catch(console.error);
