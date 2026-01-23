/**
 * Check PropertyIQ Scoring Tables
 *
 * This script checks the current state of PropertyIQ scoring tables
 * and provides guidance on what migrations need to be run.
 *
 * Usage:
 *   npx ts-node scripts/check-scoring-tables.ts
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'packages/backend/.env') });

async function getSupabaseClient(): Promise<SupabaseClient> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
  }

  return createClient(supabaseUrl, supabaseKey);
}

async function checkTable(supabase: SupabaseClient, tableName: string): Promise<{ exists: boolean; count: number; sample: any }> {
  try {
    const { data, error, count } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: false })
      .limit(1);

    if (error) {
      return { exists: false, count: 0, sample: null };
    }

    return {
      exists: true,
      count: count || 0,
      sample: data?.[0] || null,
    };
  } catch {
    return { exists: false, count: 0, sample: null };
  }
}

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  PropertyIQ Scoring System - Table Check');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  const supabase = await getSupabaseClient();

  // Tables to check
  const tables = [
    { name: 'propertyiq_scores', description: 'Main scores table' },
    { name: 'propertyiq_scores_v2', description: 'Normalized scores table (new)' },
    { name: 'score_performance_tracking', description: 'Performance tracking' },
    { name: 'formula_versions', description: 'Formula versions' },
    { name: 'realtor_metro', description: 'Realtor metro data' },
    { name: 'realtor_county', description: 'Realtor county data' },
    { name: 'realtor_zip', description: 'Realtor ZIP data' },
    { name: 'census_metro', description: 'Census metro data' },
    { name: 'census_county', description: 'Census county data' },
    { name: 'economic_metro', description: 'Economic metro data' },
    { name: 'economic_county', description: 'Economic county data' },
  ];

  console.log('Checking tables...');
  console.log('');
  console.log('┌────────────────────────────────┬────────┬──────────┐');
  console.log('│ Table                          │ Exists │ Rows     │');
  console.log('├────────────────────────────────┼────────┼──────────┤');

  const results: Record<string, { exists: boolean; count: number; sample: any }> = {};

  for (const table of tables) {
    const result = await checkTable(supabase, table.name);
    results[table.name] = result;

    const name = table.name.padEnd(30);
    const exists = result.exists ? '  ✅  ' : '  ❌  ';
    const rows = result.count.toString().padStart(8);

    console.log(`│ ${name} │${exists}│${rows} │`);
  }

  console.log('└────────────────────────────────┴────────┴──────────┘');
  console.log('');

  // Check if we need migrations
  const needsV2Migration = !results['propertyiq_scores_v2']?.exists;
  const needsPerfTrackingMigration = !results['score_performance_tracking']?.exists;

  if (needsV2Migration || needsPerfTrackingMigration) {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  Migrations Needed');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

    if (needsPerfTrackingMigration) {
      console.log('❗ Run: scripts/migrations/060-create-performance-tracking.sql');
    }
    if (needsV2Migration) {
      console.log('❗ Run: scripts/migrations/061-propertyiq-scores-normalized.sql');
    }

    console.log('');
    console.log('To run migrations:');
    console.log('1. Open Supabase Dashboard: https://supabase.com/dashboard');
    console.log('2. Select your project');
    console.log('3. Go to SQL Editor');
    console.log('4. Copy/paste each migration file and execute');
    console.log('');
  }

  // Check existing scores table schema
  if (results['propertyiq_scores']?.exists) {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  Existing propertyiq_scores Sample');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

    if (results['propertyiq_scores'].sample) {
      const sample = results['propertyiq_scores'].sample;
      const columns = Object.keys(sample);
      console.log('Columns:', columns.join(', '));
      console.log('');

      // Check if it's old schema or new schema
      if ('geography_id' in sample) {
        console.log('Schema: OLD (uses geography_id, geography_type)');
        console.log('Action: Need to run migration 061 to create new schema');
      } else if ('geography' in sample && 'score_type' in sample) {
        console.log('Schema: NEW (uses geography, location_id, score_type)');
        console.log('Status: Ready for scoring');
      }
    }
    console.log('');
  }

  // Check Realtor data availability
  if (results['realtor_metro']?.exists && results['realtor_metro'].count > 0) {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  Realtor Metro Data Sample');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

    // Get latest date
    const { data: latestData } = await supabase
      .from('realtor_metro')
      .select('period_date')
      .order('period_date', { ascending: false })
      .limit(1);

    if (latestData?.[0]) {
      console.log(`Latest period: ${latestData[0].period_date}`);

      // Check Austin data
      const { data: austinData } = await supabase
        .from('realtor_metro')
        .select('*')
        .eq('cbsa_code', '12420')
        .eq('period_date', latestData[0].period_date)
        .single();

      if (austinData) {
        console.log('');
        console.log('Austin (CBSA 12420) metrics:');
        console.log(`  - cbsa_title: ${austinData.cbsa_title}`);
        console.log(`  - hotness_score: ${austinData.hotness_score}`);
        console.log(`  - demand_score: ${austinData.demand_score}`);
        console.log(`  - pending_ratio: ${austinData.pending_ratio}`);
        console.log(`  - median_listing_price: ${austinData.median_listing_price}`);
      } else {
        console.log('');
        console.log('❌ No Austin data found for latest period');
      }
    }
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Summary');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  const hasSourceData = results['realtor_metro']?.exists && results['realtor_metro'].count > 0;
  const hasNewSchema = results['propertyiq_scores_v2']?.exists;

  if (!hasSourceData) {
    console.log('❌ No source data found. Import Realtor data first.');
  } else if (!hasNewSchema) {
    console.log('❌ New schema not found. Run migration 061 first.');
  } else {
    console.log('✅ Database is ready for scoring!');
    console.log('');
    console.log('To calculate scores, start the backend and call:');
    console.log('  POST /api/scores/calculate/metro');
  }
  console.log('');
}

main().catch(console.error);
