#!/usr/bin/env npx tsx
/**
 * Ensure Calculated Metrics (incl. cap rate) are populated.
 *
 * 1. Checks DB: Zillow ZORI/ZHVI in zillow_metro, zillow_county, zillow_zip;
 *    calculated_metrics cap_rate counts.
 * 2. If ZORI or ZHVI is missing, runs Zillow import (downloads from Zillow, inserts into long-format tables).
 * 3. Runs populate-calculated-metrics.ts to fill calculated_metrics (rent: ZORI/HUD/Census, price: Realtor).
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_KEY in packages/backend/.env (or .env.local).
 *
 * Usage: npx tsx scripts/ensure-calculated-metrics-populated.ts
 *        npx tsx scripts/ensure-calculated-metrics-populated.ts --skip-import   # Only run populate, do not import
 *        npx tsx scripts/ensure-calculated-metrics-populated.ts --check-only     # Only check DB, no import or populate
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { execSync } from 'child_process';
import { join } from 'path';

const repoRoot = join(__dirname, '..');
dotenv.config({ path: join(repoRoot, 'packages/backend/.env') });
dotenv.config({ path: join(repoRoot, '.env.local') });
dotenv.config({ path: join(repoRoot, '.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase env. Set SUPABASE_URL and SUPABASE_SERVICE_KEY (e.g. in packages/backend/.env)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface TableCheck {
  table: string;
  metric: string;
  count: number;
  latestDate: string | null;
}

async function getCountAndLatest(
  table: string,
  metricName: string
): Promise<{ count: number; latestDate: string | null }> {
  const { count, error: countError } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('metric_name', metricName);

  if (countError) {
    console.warn(`  ${table} ${metricName}: query error ${countError.message}`);
    return { count: 0, latestDate: null };
  }

  const { data: dateRow } = await supabase
    .from(table)
    .select('period_date')
    .eq('metric_name', metricName)
    .order('period_date', { ascending: false })
    .limit(1)
    .single();

  return { count: count ?? 0, latestDate: dateRow?.period_date ?? null };
}

async function checkCalculatedMetricsCapRate(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const geo of ['metro', 'county', 'zip']) {
    const { count, error } = await supabase
      .from('calculated_metrics')
      .select('*', { count: 'exact', head: true })
      .eq('geography_type', geo)
      .not('cap_rate', 'is', null);
    if (!error) out[geo] = count ?? 0;
    else out[geo] = 0;
  }
  return out;
}

async function checkDatabase(): Promise<{ needImport: boolean; summary: string[] }> {
  const summary: string[] = [];
  let needImport = false;

  const tables = [
    { table: 'zillow_metro', label: 'Metro' },
    { table: 'zillow_county', label: 'County' },
    { table: 'zillow_zip', label: 'Zip' },
  ] as const;

  console.log('\n--- Zillow long-format tables (ZORI / ZHVI) ---');
  for (const { table, label } of tables) {
    const zori = await getCountAndLatest(table, 'zori');
    const zhvi = await getCountAndLatest(table, 'zhvi');
    const zoriOk = zori.count > 0;
    const zhviOk = zhvi.count > 0;
    if (!zoriOk) needImport = true;
    if (!zhviOk) needImport = true;
    summary.push(`${label}: ZORI ${zori.count} (${zori.latestDate ?? 'n/a'}), ZHVI ${zhvi.count} (${zhvi.latestDate ?? 'n/a'})`);
    console.log(`  ${label}: ZORI ${zori.count} rows, latest ${zori.latestDate ?? 'n/a'}; ZHVI ${zhvi.count} rows, latest ${zhvi.latestDate ?? 'n/a'}`);
  }

  const capCounts = await checkCalculatedMetricsCapRate();
  console.log('\n--- calculated_metrics (cap_rate not null) ---');
  for (const [geo, count] of Object.entries(capCounts)) {
    summary.push(`calculated_metrics cap_rate ${geo}: ${count}`);
    console.log(`  ${geo}: ${count} rows`);
    if (count === 0) needImport = true; // we'll run populate which may still need ZORI/Realtor
  }

  return { needImport, summary };
}

function runImport(): void {
  console.log('\n>>> Running Zillow import (ZORI + ZHVI for Metro, County, Zip)...');
  execSync('npx tsx scripts/zillow-import/import-all.ts --level=Metro,County,Zip --metric=zori,zhvi', {
    stdio: 'inherit',
    cwd: repoRoot,
    env: { ...process.env, SUPABASE_URL: supabaseUrl, SUPABASE_SERVICE_KEY: supabaseServiceKey },
  });
}

function runPopulate(): void {
  console.log('\n>>> Running populate-calculated-metrics.ts...');
  execSync('npx tsx scripts/populate-calculated-metrics.ts', {
    stdio: 'inherit',
    cwd: repoRoot,
    env: { ...process.env, SUPABASE_URL: supabaseUrl, SUPABASE_SERVICE_KEY: supabaseServiceKey },
  });
}

async function main(): Promise<void> {
  const skipImport = process.argv.includes('--skip-import');
  const checkOnly = process.argv.includes('--check-only');

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   Ensure Calculated Metrics Populated (cap rate, etc.)');
  console.log('═══════════════════════════════════════════════════════════════');

  const { needImport, summary } = await checkDatabase();

  if (checkOnly) {
    console.log('\n--check-only: skipping import and populate.');
    process.exit(0);
  }

  if (needImport && !skipImport) {
    runImport();
  } else if (skipImport) {
    console.log('\n--skip-import: skipping Zillow import.');
  } else {
    console.log('\nZillow ZORI/ZHVI present; skipping import.');
  }

  runPopulate();

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('   Done.');
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
