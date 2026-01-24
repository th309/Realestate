/**
 * Calculate Excess Returns for PropertyIQ Backtesting
 *
 * For each historical score record, calculates excess returns:
 * - excess_return_vs_national = raw_appreciation - national_avg
 * - excess_return_vs_regional = raw_appreciation - regional_avg
 * - excess_return_vs_peer = raw_appreciation - peer_median
 *
 * Also calculates weighted excess return based on score type weights:
 * - HomeReady: 20% national, 50% regional, 30% peer
 * - InvestorEdge: 20% national, 30% regional, 50% peer
 * - Market Health: 50% national, 30% regional, 20% peer
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const HORIZONS = ['12m', '24m', '36m', '60m'];

// Benchmark weights by score type
const BENCHMARK_WEIGHTS = {
  homeready: { national: 0.20, regional: 0.50, peer: 0.30 },
  investoredge: { national: 0.20, regional: 0.30, peer: 0.50 },
  market_health: { national: 0.50, regional: 0.30, peer: 0.20 },
};

// Get column names for a horizon
function getColumns(horizon: string) {
  return {
    rawAppreciation: `actual_appreciation_${horizon}`,
    excessNational: `excess_return_vs_national_${horizon}`,
    excessRegional: `excess_return_vs_regional_${horizon}`,
    excessPeer: `excess_return_vs_peer_${horizon}`,
    weightedExcess: `weighted_excess_return_${horizon}`,
  };
}

// Cache for benchmarks to reduce DB queries
interface BenchmarkCache {
  national: Map<string, number>; // key: score_date|geo_type
  regional: Map<string, number>; // key: score_date|parent_id
  peer: Map<string, number>;     // key: score_date|peer_group_id
}

async function loadBenchmarksForPeriod(scoreDate: string, horizon: string): Promise<BenchmarkCache> {
  const cache: BenchmarkCache = {
    national: new Map(),
    regional: new Map(),
    peer: new Map(),
  };

  // Load national benchmarks
  const { data: nationalData } = await supabase
    .from('backtest_benchmarks')
    .select('geography_type, national_avg_appreciation')
    .eq('score_date', scoreDate)
    .eq('horizon', horizon);

  if (nationalData) {
    for (const row of nationalData) {
      cache.national.set(`${scoreDate}|${row.geography_type}`, row.national_avg_appreciation);
    }
  }

  // Load regional benchmarks
  const { data: regionalData } = await supabase
    .from('backtest_regional_benchmarks')
    .select('parent_geography_id, avg_appreciation')
    .eq('score_date', scoreDate)
    .eq('horizon', horizon);

  if (regionalData) {
    for (const row of regionalData) {
      cache.regional.set(`${scoreDate}|${row.parent_geography_id}`, row.avg_appreciation);
    }
  }

  // Load peer benchmarks
  const { data: peerData } = await supabase
    .from('backtest_peer_benchmarks')
    .select('peer_group_id, median_appreciation')
    .eq('score_date', scoreDate)
    .eq('horizon', horizon);

  if (peerData) {
    for (const row of peerData) {
      cache.peer.set(`${scoreDate}|${row.peer_group_id}`, row.median_appreciation);
    }
  }

  return cache;
}

// Process records for a specific period and horizon
async function processRecords(
  scoreDate: string,
  horizon: string,
  cache: BenchmarkCache
): Promise<{ updated: number; skipped: number }> {
  const columns = getColumns(horizon);
  let updated = 0;
  let skipped = 0;
  const pageSize = 500;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    // Fetch records that have raw appreciation but no excess return yet
    const { data: records, error } = await supabase
      .from('propertyiq_scores_history')
      .select(`id, geography_type, peer_group_id, parent_geography_id, ${columns.rawAppreciation}`)
      .eq('period_date', scoreDate)
      .not(columns.rawAppreciation, 'is', null)
      .is(columns.excessNational, null)
      .range(offset, offset + pageSize - 1);

    if (error || !records || records.length === 0) {
      hasMore = false;
      continue;
    }

    // Calculate excess returns for each record
    const updates: any[] = [];

    for (const record of records) {
      const rawAppreciation = record[columns.rawAppreciation];
      if (rawAppreciation == null) {
        skipped++;
        continue;
      }

      // Get benchmarks
      const nationalBenchmark = cache.national.get(`${scoreDate}|${record.geography_type}`);
      const regionalBenchmark = record.parent_geography_id
        ? cache.regional.get(`${scoreDate}|${record.parent_geography_id}`)
        : null;
      const peerBenchmark = record.peer_group_id
        ? cache.peer.get(`${scoreDate}|${record.peer_group_id}`)
        : null;

      // Calculate excess returns
      const excessNational = nationalBenchmark != null
        ? rawAppreciation - nationalBenchmark
        : null;
      const excessRegional = regionalBenchmark != null
        ? rawAppreciation - regionalBenchmark
        : null;
      const excessPeer = peerBenchmark != null
        ? rawAppreciation - peerBenchmark
        : null;

      // Calculate weighted excess return (using InvestorEdge weights as default)
      let weightedExcess: number | null = null;
      if (excessNational != null || excessRegional != null || excessPeer != null) {
        const weights = BENCHMARK_WEIGHTS.investoredge;
        let totalWeight = 0;
        let weightedSum = 0;

        if (excessNational != null) {
          weightedSum += excessNational * weights.national;
          totalWeight += weights.national;
        }
        if (excessRegional != null) {
          weightedSum += excessRegional * weights.regional;
          totalWeight += weights.regional;
        }
        if (excessPeer != null) {
          weightedSum += excessPeer * weights.peer;
          totalWeight += weights.peer;
        }

        if (totalWeight > 0) {
          weightedExcess = weightedSum / totalWeight;
        }
      }

      // Prepare update
      const update: any = { id: record.id };
      if (excessNational != null) {
        update[columns.excessNational] = Math.round(excessNational * 100000) / 100000;
      }
      if (excessRegional != null) {
        update[columns.excessRegional] = Math.round(excessRegional * 100000) / 100000;
      }
      if (excessPeer != null) {
        update[columns.excessPeer] = Math.round(excessPeer * 100000) / 100000;
      }
      if (weightedExcess != null) {
        update[columns.weightedExcess] = Math.round(weightedExcess * 100000) / 100000;
      }

      if (Object.keys(update).length > 1) {
        updates.push(update);
        updated++;
      } else {
        skipped++;
      }
    }

    // Batch update
    for (const update of updates) {
      const { id, ...data } = update;
      await supabase
        .from('propertyiq_scores_history')
        .update(data)
        .eq('id', id);
    }

    offset += pageSize;
    hasMore = records.length === pageSize;
  }

  return { updated, skipped };
}

// Get distinct score dates with outcomes
async function getScoreDatesWithOutcomes(horizon: string): Promise<string[]> {
  const column = `actual_appreciation_${horizon}`;
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
  console.log('║  EXCESS RETURN CALCULATION                                    ║');
  console.log('║  Computing benchmark-adjusted returns for validation          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  let grandTotalUpdated = 0;
  let grandTotalSkipped = 0;

  // Process each horizon
  for (const horizon of HORIZONS) {
    console.log(`\n═══════════════════════════════════════════════════════════════`);
    console.log(`  Processing ${horizon} horizon`);
    console.log(`═══════════════════════════════════════════════════════════════`);

    // Get dates with raw outcomes for this horizon
    const dates = await getScoreDatesWithOutcomes(horizon);
    console.log(`  Found ${dates.length} score dates with ${horizon} outcomes`);

    if (dates.length === 0) continue;

    let horizonUpdated = 0;
    let horizonSkipped = 0;

    for (const scoreDate of dates) {
      process.stdout.write(`  ${scoreDate}: `);

      // Load benchmarks for this period
      const cache = await loadBenchmarksForPeriod(scoreDate, horizon);
      console.log(`benchmarks loaded (${cache.national.size} nat, ${cache.regional.size} reg, ${cache.peer.size} peer)`);

      // Process records
      const result = await processRecords(scoreDate, horizon, cache);
      horizonUpdated += result.updated;
      horizonSkipped += result.skipped;

      process.stdout.write(`    → ${result.updated} updated, ${result.skipped} skipped\n`);
    }

    console.log(`\n  ${horizon} totals: ${horizonUpdated} updated, ${horizonSkipped} skipped`);
    grandTotalUpdated += horizonUpdated;
    grandTotalSkipped += horizonSkipped;
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Total records updated: ${grandTotalUpdated.toLocaleString()}`);
  console.log(`  Total records skipped: ${grandTotalSkipped.toLocaleString()}`);

  // Show sample excess returns
  console.log('\n  Sample excess returns (12m, top InvestorEdge scores):');
  const { data: samples } = await supabase
    .from('propertyiq_scores_history')
    .select('geography_id, geography_type, period_date, investoredge_score, actual_appreciation_12m, excess_return_vs_national_12m, weighted_excess_return_12m')
    .not('weighted_excess_return_12m', 'is', null)
    .order('investoredge_score', { ascending: false })
    .limit(5);

  if (samples) {
    for (const s of samples) {
      const raw = s.actual_appreciation_12m != null ? `${(s.actual_appreciation_12m * 100).toFixed(1)}%` : 'N/A';
      const excess = s.weighted_excess_return_12m != null ? `${(s.weighted_excess_return_12m * 100).toFixed(1)}%` : 'N/A';
      console.log(`    ${s.geography_id} (${s.geography_type}): Score=${s.investoredge_score}, Raw=${raw}, Excess=${excess}`);
    }
  }

  console.log('\n✓ Excess return calculation complete');
}

main().catch(console.error);
