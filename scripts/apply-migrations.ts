/**
 * Apply PropertyIQ Scoring Migrations
 *
 * This script applies migrations directly using the Supabase connection.
 *
 * Usage:
 *   npx ts-node scripts/apply-migrations.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), 'packages/backend/.env') });

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'scripts/migrations');

async function main(): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  PropertyIQ Scoring - Apply Migrations');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  // Check if propertyiq_scores_v2 table already exists
  const { data: existingTable } = await supabase
    .from('propertyiq_scores_v2')
    .select('id')
    .limit(1);

  if (existingTable !== null) {
    console.log('✅ propertyiq_scores_v2 table already exists');
    console.log('   Migrations appear to be already applied.');
    console.log('');
    return;
  }

  console.log('📋 Migrations need to be applied via Supabase Dashboard:');
  console.log('');
  console.log('   The Supabase REST API does not support DDL statements.');
  console.log('   Please run the following SQL files in the SQL Editor:');
  console.log('');
  console.log('   1. Open: https://supabase.com/dashboard');
  console.log('   2. Select your project');
  console.log('   3. Go to SQL Editor (left sidebar)');
  console.log('   4. Run each migration file below');
  console.log('');

  const migrations = [
    '060-create-performance-tracking.sql',
    '061-propertyiq-scores-normalized.sql',
  ];

  for (const migration of migrations) {
    const filePath = path.join(MIGRATIONS_DIR, migration);
    if (fs.existsSync(filePath)) {
      console.log(`   📄 ${migration}`);
      console.log(`      Path: ${filePath}`);
    }
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Quick Copy: Migration 061 (Main Schema)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  // Print a simplified version that can be copied
  const simplifiedMigration = `
-- PropertyIQ Scores V2 - Normalized Schema
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS propertyiq_scores_v2 (
    id BIGSERIAL PRIMARY KEY,
    geography VARCHAR(10) NOT NULL,
    location_id VARCHAR(20) NOT NULL,
    location_name VARCHAR(255),
    score_type VARCHAR(20) NOT NULL,
    score DECIMAL(5,1),
    grade VARCHAR(2),
    confidence DECIMAL(5,1),
    confidence_level VARCHAR(12),
    median_price DECIMAL(12,2),
    return_1y DECIMAL(6,2),
    return_3y_ann DECIMAL(6,2),
    score_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_geography CHECK (geography IN ('metro', 'county', 'zip')),
    CONSTRAINT valid_score_type CHECK (score_type IN ('homeready', 'investoredge', 'markethealth')),
    CONSTRAINT valid_score_range CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
    CONSTRAINT valid_confidence_range CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 100)),
    CONSTRAINT valid_confidence_level CHECK (confidence_level IN ('HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT')),
    CONSTRAINT unique_normalized_score UNIQUE (geography, location_id, score_type, score_date)
);

CREATE INDEX IF NOT EXISTS idx_piq_v2_location ON propertyiq_scores_v2(geography, location_id, score_date DESC);
CREATE INDEX IF NOT EXISTS idx_piq_v2_top_markets ON propertyiq_scores_v2(geography, score_type, score_date, score DESC);
CREATE INDEX IF NOT EXISTS idx_piq_v2_search ON propertyiq_scores_v2(location_name text_pattern_ops);

GRANT SELECT, INSERT, UPDATE, DELETE ON propertyiq_scores_v2 TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON propertyiq_scores_v2 TO authenticated;
GRANT SELECT ON propertyiq_scores_v2 TO anon;
GRANT USAGE ON SEQUENCE propertyiq_scores_v2_id_seq TO service_role;
GRANT USAGE ON SEQUENCE propertyiq_scores_v2_id_seq TO authenticated;
`;

  console.log(simplifiedMigration);
  console.log('');
}

main().catch(console.error);
