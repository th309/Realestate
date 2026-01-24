/**
 * Calculate Benchmarks for PropertyIQ Backtesting
 *
 * Calculates three levels of benchmarks for each score date and horizon:
 * 1. National: Average appreciation across all geographies
 * 2. Regional: Average appreciation within parent geography (metro/state)
 * 3. Peer Group: Median appreciation within peer group
 *
 * These benchmarks enable excess return calculations for validation.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const HORIZONS = ['12m', '24m', '36m', '60m', '120m'];
const GEO_TYPES = ['state', 'metro', 'county', 'zip'];

// Map horizon string to column name
function getAppreciationColumn(horizon: string): string {
  return `actual_appreciation_${horizon}`;
}

// Calculate percentiles from an array
function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

// Calculate national benchmarks for a period/horizon/geo type
async function calculateNationalBenchmarks(
  scoreDate: string,
  horizon: string,
  geoType: string
): Promise<{ avg: number; median: number; p25: number; p75: number; count: number } | null> {
  const column = getAppreciationColumn(horizon);

  // Fetch all appreciation values for this combination
  const { data, error } = await supabase
    .from('propertyiq_scores_history')
    .select(column)
    .eq('period_date', scoreDate)
    .eq('geography_type', geoType)
    .not(column, 'is', null);

  if (error || !data || data.length === 0) {
    return null;
  }

  const values = data.map((d: any) => d[column]).filter((v: any) => v != null) as number[];
  if (values.length === 0) return null;

  const sum = values.reduce((a, b) => a + b, 0);
  const avg = sum / values.length;
  const median = percentile(values, 50);
  const p25 = percentile(values, 25);
  const p75 = percentile(values, 75);

  return { avg, median, p25, p75, count: values.length };
}

// Calculate regional benchmarks for a period/horizon
async function calculateRegionalBenchmarks(
  scoreDate: string,
  horizon: string
): Promise<Map<string, { avg: number; median: number; p25: number; p75: number; count: number }>> {
  const column = getAppreciationColumn(horizon);
  const results = new Map();

  // Fetch all records with parent geography
  const { data, error } = await supabase
    .from('propertyiq_scores_history')
    .select(`${column}, parent_geography_id`)
    .eq('period_date', scoreDate)
    .not(column, 'is', null)
    .not('parent_geography_id', 'is', null);

  if (error || !data) {
    return results;
  }

  // Group by parent geography
  const groups = new Map<string, number[]>();
  for (const row of data) {
    const parentId = row.parent_geography_id;
    const value = row[column];
    if (parentId && value != null) {
      if (!groups.has(parentId)) {
        groups.set(parentId, []);
      }
      groups.get(parentId)!.push(value);
    }
  }

  // Calculate stats for each group
  for (const [parentId, values] of groups) {
    if (values.length < 3) continue; // Need at least 3 children

    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const median = percentile(values, 50);
    const p25 = percentile(values, 25);
    const p75 = percentile(values, 75);

    results.set(parentId, { avg, median, p25, p75, count: values.length });
  }

  return results;
}

// Calculate peer group benchmarks for a period/horizon
async function calculatePeerBenchmarks(
  scoreDate: string,
  horizon: string
): Promise<Map<string, { avg: number; median: number; p25: number; p75: number; count: number }>> {
  const column = getAppreciationColumn(horizon);
  const results = new Map();

  // Fetch all records with peer group
  const { data, error } = await supabase
    .from('propertyiq_scores_history')
    .select(`${column}, peer_group_id`)
    .eq('period_date', scoreDate)
    .not(column, 'is', null)
    .not('peer_group_id', 'is', null);

  if (error || !data) {
    return results;
  }

  // Group by peer group
  const groups = new Map<string, number[]>();
  for (const row of data) {
    const peerGroupId = row.peer_group_id;
    const value = row[column];
    if (peerGroupId && value != null) {
      if (!groups.has(peerGroupId)) {
        groups.set(peerGroupId, []);
      }
      groups.get(peerGroupId)!.push(value);
    }
  }

  // Calculate stats for each group
  for (const [peerGroupId, values] of groups) {
    if (values.length < 3) continue; // Need at least 3 peers

    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const median = percentile(values, 50);
    const p25 = percentile(values, 25);
    const p75 = percentile(values, 75);

    results.set(peerGroupId, { avg, median, p25, p75, count: values.length });
  }

  return results;
}

// Get distinct score dates with outcomes
async function getScoreDatesWithOutcomes(horizon: string): Promise<string[]> {
  const column = getAppreciationColumn(horizon);
  const dates: string[] = [];
  const pageSize = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data } = await supabase
      .from('propertyiq_scores_history')
      .select('period_date')
      .not(column, 'is', null)
      .order('period_date', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (data && data.length > 0) {
      dates.push(...data.map(d => d.period_date));
      offset += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  return [...new Set(dates)].sort((a, b) => b.localeCompare(a));
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  BENCHMARK CALCULATION                                        ║');
  console.log('║  Computing national, regional, and peer group benchmarks      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  let totalNational = 0;
  let totalRegional = 0;
  let totalPeer = 0;

  // Process each horizon
  for (const horizon of HORIZONS) {
    console.log(`\n═══════════════════════════════════════════════════════════════`);
    console.log(`  Processing ${horizon} horizon`);
    console.log(`═══════════════════════════════════════════════════════════════`);

    // Get dates with data for this horizon
    const dates = await getScoreDatesWithOutcomes(horizon);
    console.log(`  Found ${dates.length} score dates with ${horizon} outcomes`);

    if (dates.length === 0) continue;

    for (const scoreDate of dates) {
      process.stdout.write(`  ${scoreDate}: `);

      // 1. National benchmarks (one per geo type)
      for (const geoType of GEO_TYPES) {
        const national = await calculateNationalBenchmarks(scoreDate, horizon, geoType);
        if (national) {
          const { error } = await supabase
            .from('backtest_benchmarks')
            .upsert({
              score_date: scoreDate,
              horizon: horizon,
              geography_type: geoType,
              national_avg_appreciation: Math.round(national.avg * 100000) / 100000,
              national_median_appreciation: Math.round(national.median * 100000) / 100000,
              national_p25_appreciation: Math.round(national.p25 * 100000) / 100000,
              national_p75_appreciation: Math.round(national.p75 * 100000) / 100000,
              sample_count: national.count,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'score_date,horizon,geography_type' });

          if (!error) totalNational++;
        }
      }

      // 2. Regional benchmarks
      const regionalBenchmarks = await calculateRegionalBenchmarks(scoreDate, horizon);
      for (const [parentId, stats] of regionalBenchmarks) {
        const { error } = await supabase
          .from('backtest_regional_benchmarks')
          .upsert({
            score_date: scoreDate,
            horizon: horizon,
            parent_geography_id: parentId,
            parent_geography_type: parentId.length === 2 ? 'state' : 'metro',
            avg_appreciation: Math.round(stats.avg * 100000) / 100000,
            median_appreciation: Math.round(stats.median * 100000) / 100000,
            p25_appreciation: Math.round(stats.p25 * 100000) / 100000,
            p75_appreciation: Math.round(stats.p75 * 100000) / 100000,
            child_count: stats.count,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'score_date,horizon,parent_geography_id' });

        if (!error) totalRegional++;
      }

      // 3. Peer group benchmarks
      const peerBenchmarks = await calculatePeerBenchmarks(scoreDate, horizon);
      for (const [peerGroupId, stats] of peerBenchmarks) {
        const { error } = await supabase
          .from('backtest_peer_benchmarks')
          .upsert({
            score_date: scoreDate,
            horizon: horizon,
            peer_group_id: peerGroupId,
            avg_appreciation: Math.round(stats.avg * 100000) / 100000,
            median_appreciation: Math.round(stats.median * 100000) / 100000,
            p25_appreciation: Math.round(stats.p25 * 100000) / 100000,
            p75_appreciation: Math.round(stats.p75 * 100000) / 100000,
            peer_count: stats.count,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'score_date,horizon,peer_group_id' });

        if (!error) totalPeer++;
      }

      console.log(`${regionalBenchmarks.size} regional, ${peerBenchmarks.size} peer`);
    }
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  National benchmarks: ${totalNational.toLocaleString()}`);
  console.log(`  Regional benchmarks: ${totalRegional.toLocaleString()}`);
  console.log(`  Peer group benchmarks: ${totalPeer.toLocaleString()}`);

  // Show sample benchmarks
  console.log('\n  Sample national benchmarks (12m horizon):');
  const { data: samples } = await supabase
    .from('backtest_benchmarks')
    .select('*')
    .eq('horizon', '12m')
    .order('score_date', { ascending: false })
    .limit(5);

  if (samples) {
    for (const s of samples) {
      console.log(`    ${s.score_date} ${s.geography_type}: avg=${(s.national_avg_appreciation * 100).toFixed(2)}%, median=${(s.national_median_appreciation * 100).toFixed(2)}%, n=${s.sample_count}`);
    }
  }

  console.log('\n✓ Benchmark calculation complete');
}

main().catch(console.error);
