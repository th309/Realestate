#!/usr/bin/env npx tsx
/**
 * Populate CBSA codes in zillow_metro table from zillow_metro_crosswalk
 * 
 * This script backfills missing cbsa_code values in zillow_metro by matching
 * region_id to the zillow_metro_crosswalk table.
 * 
 * Usage:
 *   npx tsx scripts/populate-metro-cbsa-from-crosswalk.ts
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../packages/backend/.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function populateMetroCbsaFromCrosswalk() {
  console.log('='.repeat(60));
  console.log('POPULATE CBSA CODES IN ZILLOW_METRO FROM CROSSWALK');
  console.log('='.repeat(60));

  // Step 1: Get all unique region_ids from zillow_metro that need CBSA codes
  // Also get breakdown by metric_name to verify all metric types are covered
  console.log('\n[Step 1] Finding records with missing cbsa_code...');
  
  const allMissingRegionIds: number[] = [];
  const metricBreakdownBefore = new Map<string, number>();
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const { data: missingRows, error: missingError } = await supabase
      .from('zillow_metro')
      .select('region_id, metric_name')
      .is('cbsa_code', null)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (missingError) {
      console.error('Error reading missing cbsa_code rows:', missingError.message);
      return;
    }

    if (!missingRows || missingRows.length === 0) break;

    const regionIds = missingRows
      .map((row) => Number(row.region_id))
      .filter((id) => Number.isFinite(id));

    allMissingRegionIds.push(...regionIds);

    // Track metrics that need updating
    missingRows.forEach((row) => {
      if (row.metric_name) {
        metricBreakdownBefore.set(
          row.metric_name,
          (metricBreakdownBefore.get(row.metric_name) || 0) + 1
        );
      }
    });

    if (missingRows.length < pageSize) break;
    page++;
  }

  const uniqueMissingIds = [...new Set(allMissingRegionIds)];
  console.log(`Found ${uniqueMissingIds.length} unique region_ids with missing cbsa_code`);
  
  // Show breakdown by metric_name
  if (metricBreakdownBefore.size > 0) {
    console.log('\nMissing cbsa_code breakdown by metric_name:');
    const sortedMetrics = Array.from(metricBreakdownBefore.entries())
      .sort((a, b) => b[1] - a[1]);
    sortedMetrics.forEach(([metric, count]) => {
      console.log(`  ${metric}: ${count.toLocaleString()} rows`);
    });
  }

  if (uniqueMissingIds.length === 0) {
    console.log('\nNo records need updating. All CBSA codes are already populated!');
    return;
  }

  // Step 2: Load CBSA mappings from crosswalk table
  console.log('\n[Step 2] Loading CBSA mappings from zillow_metro_crosswalk...');
  
  const cbsaByRegionId = new Map<number, string>();
  const chunkSize = 1000;

  for (let i = 0; i < uniqueMissingIds.length; i += chunkSize) {
    const chunk = uniqueMissingIds.slice(i, i + chunkSize);
    
    const { data: crosswalkRows, error: crosswalkError } = await supabase
      .from('zillow_metro_crosswalk')
      .select('zillow_region_id, cbsa_code')
      .in('zillow_region_id', chunk)
      .not('cbsa_code', 'is', null);

    if (crosswalkError) {
      console.error(`Error loading crosswalk chunk (${i}-${i + chunk.length}):`, crosswalkError.message);
      continue;
    }

    crosswalkRows?.forEach((row) => {
      if (row.zillow_region_id && row.cbsa_code) {
        cbsaByRegionId.set(row.zillow_region_id, row.cbsa_code);
      }
    });

    if ((i / chunkSize + 1) % 10 === 0) {
      console.log(`  Processed ${Math.min(i + chunkSize, uniqueMissingIds.length)}/${uniqueMissingIds.length} region_ids...`);
    }
  }

  console.log(`Loaded ${cbsaByRegionId.size} CBSA mappings from crosswalk`);

  if (cbsaByRegionId.size === 0) {
    console.log('\nNo matching CBSA codes found in crosswalk. Nothing to update.');
    return;
  }

  // Step 3: Update zillow_metro table with CBSA codes
  // NOTE: The update query updates ALL rows for each region_id where cbsa_code is NULL,
  // regardless of metric_name. This ensures all metric types (zhvi, zori, zhvf_1m, etc.)
  // are updated for each region_id in a single operation.
  console.log('\n[Step 3] Updating zillow_metro table...');
  console.log('  (This will update ALL metric types for each region_id)');
  
  let totalUpdated = 0;
  let totalRowsUpdated = 0;
  let totalErrors = 0;
  const updateChunkSize = 100;

  const updates = Array.from(cbsaByRegionId.entries());
  
  for (let i = 0; i < updates.length; i += updateChunkSize) {
    const chunk = updates.slice(i, i + updateChunkSize);
    
    // Update each region_id in the chunk
    const updatePromises = chunk.map(async ([regionId, cbsaCode]) => {
      // First, count how many rows will be updated for this region_id
      const { count: rowsToUpdate } = await supabase
        .from('zillow_metro')
        .select('*', { count: 'exact', head: true })
        .eq('region_id', regionId)
        .is('cbsa_code', null);

      const { error } = await supabase
        .from('zillow_metro')
        .update({ cbsa_code: cbsaCode })
        .eq('region_id', regionId)
        .is('cbsa_code', null);

      if (error) {
        console.error(`  Error updating region_id ${regionId}: ${error.message}`);
        totalErrors++;
        return { success: false, rowsUpdated: 0 };
      }
      return { success: true, rowsUpdated: rowsToUpdate || 0 };
    });

    const results = await Promise.all(updatePromises);
    const chunkUpdated = results.filter(r => r.success).length;
    const chunkRowsUpdated = results.reduce((sum, r) => sum + r.rowsUpdated, 0);
    totalUpdated += chunkUpdated;
    totalRowsUpdated += chunkRowsUpdated;

    if ((i / updateChunkSize + 1) % 10 === 0 || i + updateChunkSize >= updates.length) {
      console.log(`  Updated ${totalUpdated}/${updates.length} region_ids (${totalRowsUpdated.toLocaleString()} total rows)...`);
    }
  }

  console.log(`\n[Step 4] Update Summary:`);
  console.log(`  Successfully updated: ${totalUpdated} unique region_ids`);
  console.log(`  Total rows updated: ${totalRowsUpdated.toLocaleString()} (across all metric types)`);
  console.log(`  Errors: ${totalErrors}`);

  // Step 5: Verify results and show breakdown by metric_name
  console.log('\n[Step 5] Verifying results...');
  
  const { count: remainingNull } = await supabase
    .from('zillow_metro')
    .select('*', { count: 'exact', head: true })
    .is('cbsa_code', null);

  const { count: withCbsa } = await supabase
    .from('zillow_metro')
    .select('*', { count: 'exact', head: true })
    .not('cbsa_code', 'is', null);

  const { count: totalRows } = await supabase
    .from('zillow_metro')
    .select('*', { count: 'exact', head: true });

  // Get breakdown by metric_name for remaining NULLs
  const metricBreakdownAfter = new Map<string, number>();
  let verifyPage = 0;
  while (true) {
    const { data: remainingRows } = await supabase
      .from('zillow_metro')
      .select('metric_name')
      .is('cbsa_code', null)
      .range(verifyPage * pageSize, (verifyPage + 1) * pageSize - 1);

    if (!remainingRows || remainingRows.length === 0) break;

    remainingRows.forEach((row) => {
      if (row.metric_name) {
        metricBreakdownAfter.set(
          row.metric_name,
          (metricBreakdownAfter.get(row.metric_name) || 0) + 1
        );
      }
    });

    if (remainingRows.length < pageSize) break;
    verifyPage++;
  }

  // Get all unique metric names in the table to show complete coverage
  const { data: allMetrics } = await supabase
    .from('zillow_metro')
    .select('metric_name')
    .limit(10000);

  const allMetricNames = new Set<string>();
  allMetrics?.forEach((row) => {
    if (row.metric_name) {
      allMetricNames.add(row.metric_name);
    }
  });

  console.log('\n--- FINAL STATISTICS ---');
  console.log(`Total rows in zillow_metro: ${totalRows || 0}`);
  console.log(`Rows with cbsa_code: ${withCbsa || 0}`);
  console.log(`Rows still NULL: ${remainingNull || 0}`);
  
  if (totalRows) {
    const coverage = ((withCbsa || 0) / totalRows * 100).toFixed(2);
    console.log(`Coverage: ${coverage}%`);
  }

  // Show metric breakdown
  if (metricBreakdownAfter.size > 0) {
    console.log('\nRemaining NULL cbsa_code by metric_name:');
    const sortedRemaining = Array.from(metricBreakdownAfter.entries())
      .sort((a, b) => b[1] - a[1]);
    sortedRemaining.forEach(([metric, count]) => {
      console.log(`  ${metric}: ${count.toLocaleString()} rows`);
    });
  } else {
    console.log('\n✅ All metrics now have cbsa_code populated!');
  }

  // Show all metric types found in the table
  console.log(`\nAll metric types found in zillow_metro (${allMetricNames.size} total):`);
  const sortedAllMetrics = Array.from(allMetricNames).sort();
  sortedAllMetrics.forEach((metric) => {
    const beforeCount = metricBreakdownBefore.get(metric) || 0;
    const afterCount = metricBreakdownAfter.get(metric) || 0;
    const status = afterCount === 0 ? '✅' : '⚠️';
    console.log(`  ${status} ${metric} (${beforeCount} → ${afterCount} remaining)`);
  });

  console.log('\n' + '='.repeat(60));
  console.log('DONE');
  console.log('='.repeat(60));
}

populateMetroCbsaFromCrosswalk().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
