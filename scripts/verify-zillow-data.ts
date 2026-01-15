#!/usr/bin/env npx tsx
/**
 * Verify Zillow Data Import
 *
 * Checks all Zillow tables for data integrity:
 * - zillow_state
 * - zillow_metro
 * - zillow_county
 * - zillow_zip
 *
 * Verifies:
 * - Record counts per table
 * - Metric coverage
 * - Date ranges
 * - CBSA code coverage (for metro)
 * - FIPS code coverage (for county)
 *
 * Usage:
 *   npx tsx scripts/verify-zillow-data.ts
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables
config({ path: join(__dirname, '../packages/backend/.env') });
config({ path: join(__dirname, '../web/.env.local') });
config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

interface TableStats {
  tableName: string;
  totalRecords: number;
  uniqueRegions: number;
  metrics: string[];
  dateRange: { min: string; max: string } | null;
  extraStats?: Record<string, any>;
}

const ZILLOW_TABLES = [
  'zillow_state',
  'zillow_metro',
  'zillow_city',
  'zillow_county',
  'zillow_zip'
];

const EXPECTED_METRICS = [
  'zhvi',
  'zori',
  'inventory',
  'sales_count',
  'sales_price',
  'days_to_pending',
  'new_listings',
  'price_cuts',
  'sale_to_list',
  'sold_above_list',
  'list_price',
  'new_construction_sales_count',
  'new_construction_sales_price',
  'new_pending_listings',
  'condo_zhvi',
  'sfr_zhvi',
  'price_per_sqft',
  'rent_per_sqft',
  'new_construction_zhvi',
  'market_heat_index'
];

async function getTableStats(tableName: string): Promise<TableStats | null> {
  console.log(`\n📊 Checking ${tableName}...`);

  // Get total record count
  const { count: totalRecords, error: countError } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error(`  ❌ Error counting records: ${countError.message}`);
    return null;
  }

  if (!totalRecords || totalRecords === 0) {
    console.log(`  ⚠️ Table is empty`);
    return {
      tableName,
      totalRecords: 0,
      uniqueRegions: 0,
      metrics: [],
      dateRange: null
    };
  }

  // Get unique region count
  const { data: regionData, error: regionError } = await supabase
    .from(tableName)
    .select('region_id')
    .limit(100000);

  const uniqueRegions = regionData
    ? new Set(regionData.map(r => r.region_id)).size
    : 0;

  // Get distinct metrics
  const { data: metricData, error: metricError } = await supabase
    .from(tableName)
    .select('metric_name')
    .limit(100000);

  const metrics = metricData
    ? [...new Set(metricData.map(r => r.metric_name))].filter(Boolean).sort()
    : [];

  // Get date range
  const { data: minDateData } = await supabase
    .from(tableName)
    .select('period_date')
    .order('period_date', { ascending: true })
    .limit(1);

  const { data: maxDateData } = await supabase
    .from(tableName)
    .select('period_date')
    .order('period_date', { ascending: false })
    .limit(1);

  const dateRange = minDateData?.[0]?.period_date && maxDateData?.[0]?.period_date
    ? { min: minDateData[0].period_date, max: maxDateData[0].period_date }
    : null;

  const stats: TableStats = {
    tableName,
    totalRecords: totalRecords || 0,
    uniqueRegions,
    metrics,
    dateRange
  };

  // Extra stats for metro (CBSA coverage)
  if (tableName === 'zillow_metro') {
    const { count: withCbsa } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true })
      .not('cbsa_code', 'is', null);

    const { count: withoutCbsa } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true })
      .is('cbsa_code', null);

    stats.extraStats = {
      cbsaCoverage: {
        withCbsa: withCbsa || 0,
        withoutCbsa: withoutCbsa || 0,
        percentage: totalRecords && withCbsa
          ? ((withCbsa / totalRecords) * 100).toFixed(2)
          : '0'
      }
    };
  }

  // Extra stats for county (FIPS coverage)
  if (tableName === 'zillow_county') {
    const { count: withFips } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true })
      .not('fips_code', 'is', null);

    const { count: withoutFips } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true })
      .is('fips_code', null);

    stats.extraStats = {
      fipsCoverage: {
        withFips: withFips || 0,
        withoutFips: withoutFips || 0,
        percentage: totalRecords && withFips
          ? ((withFips / totalRecords) * 100).toFixed(2)
          : '0'
      }
    };
  }

  return stats;
}

function printTableStats(stats: TableStats): void {
  console.log(`\n  📈 ${stats.tableName}`);
  console.log(`     Total records: ${stats.totalRecords.toLocaleString()}`);
  console.log(`     Unique regions: ${stats.uniqueRegions.toLocaleString()}`);
  console.log(`     Metrics (${stats.metrics.length}): ${stats.metrics.join(', ') || 'none'}`);

  if (stats.dateRange) {
    console.log(`     Date range: ${stats.dateRange.min} to ${stats.dateRange.max}`);
  }

  if (stats.extraStats?.cbsaCoverage) {
    const cbsa = stats.extraStats.cbsaCoverage;
    console.log(`     CBSA coverage: ${cbsa.percentage}% (${cbsa.withCbsa.toLocaleString()} with, ${cbsa.withoutCbsa.toLocaleString()} without)`);
  }

  if (stats.extraStats?.fipsCoverage) {
    const fips = stats.extraStats.fipsCoverage;
    console.log(`     FIPS coverage: ${fips.percentage}% (${fips.withFips.toLocaleString()} with, ${fips.withoutFips.toLocaleString()} without)`);
  }

  // Check for missing expected metrics
  const missingMetrics = EXPECTED_METRICS.filter(m => !stats.metrics.includes(m));
  if (missingMetrics.length > 0 && stats.totalRecords > 0) {
    console.log(`     ⚠️ Missing metrics: ${missingMetrics.join(', ')}`);
  }
}

async function checkMetroMissingCbsa(): Promise<void> {
  console.log('\n🔍 Checking metros without CBSA codes...');

  const { data, error } = await supabase
    .from('zillow_metro')
    .select('region_id, region_name')
    .is('cbsa_code', null)
    .limit(100);

  if (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return;
  }

  if (!data || data.length === 0) {
    console.log('  ✅ All metros have CBSA codes!');
    return;
  }

  // Get unique metros
  const uniqueMetros = new Map<string, string>();
  for (const record of data) {
    if (record.region_id && !uniqueMetros.has(record.region_id)) {
      uniqueMetros.set(record.region_id, record.region_name);
    }
  }

  console.log(`  Found ${uniqueMetros.size} unique metros without CBSA codes:`);
  let count = 0;
  for (const [regionId, regionName] of uniqueMetros) {
    if (count < 20) {
      console.log(`    - ${regionName} (region_id: ${regionId})`);
    }
    count++;
  }
  if (count > 20) {
    console.log(`    ... and ${count - 20} more`);
  }
}

async function checkRecordsPerMetric(): Promise<void> {
  console.log('\n📊 Records per metric across all tables...\n');

  for (const tableName of ZILLOW_TABLES) {
    console.log(`  ${tableName}:`);

    for (const metric of EXPECTED_METRICS) {
      const { count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true })
        .eq('metric_name', metric);

      if (count && count > 0) {
        console.log(`    ${metric}: ${count.toLocaleString()}`);
      }
    }
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('🔍 Zillow Data Verification Report');
  console.log('='.repeat(60));

  const allStats: TableStats[] = [];

  // Get stats for each table
  for (const tableName of ZILLOW_TABLES) {
    const stats = await getTableStats(tableName);
    if (stats) {
      allStats.push(stats);
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 SUMMARY');
  console.log('='.repeat(60));

  for (const stats of allStats) {
    printTableStats(stats);
  }

  // Check metros without CBSA
  await checkMetroMissingCbsa();

  // Optional: detailed metric counts (can be slow)
  const args = process.argv.slice(2);
  if (args.includes('--detailed')) {
    await checkRecordsPerMetric();
  }

  // Final summary
  console.log('\n' + '='.repeat(60));
  console.log('✅ Verification complete!');
  console.log('='.repeat(60));

  const totalRecords = allStats.reduce((sum, s) => sum + s.totalRecords, 0);
  console.log(`\nTotal records across all tables: ${totalRecords.toLocaleString()}`);

  // Check for potential issues
  const issues: string[] = [];

  for (const stats of allStats) {
    if (stats.totalRecords === 0) {
      issues.push(`${stats.tableName} is empty`);
    }
    if (stats.metrics.length < 5) {
      issues.push(`${stats.tableName} has only ${stats.metrics.length} metrics`);
    }
    if (stats.extraStats?.cbsaCoverage?.percentage < 95) {
      issues.push(`${stats.tableName} CBSA coverage is only ${stats.extraStats.cbsaCoverage.percentage}%`);
    }
  }

  if (issues.length > 0) {
    console.log('\n⚠️ Potential issues:');
    issues.forEach(issue => console.log(`  - ${issue}`));
  } else {
    console.log('\n✅ No major issues detected!');
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
