/**
 * Shadow-compare gate: prove the production TS scorer reproduces the Python
 * backfill for a given month, at every geo level.
 *
 * Runs the exact production code path (fetchPropertyIqMetrics ->
 * calculatePropertyIqScores) for --date and compares the resulting scores to
 * the backfilled rows already in propertyiq_scores_v2. No writes.
 *
 * Usage:
 *   npx ts-node packages/backend/src/scripts/shadow-compare-scores.ts --date=2026-04-30
 */

import { loadEnvFile } from './backfill-helpers';

loadEnvFile();

import { createClient } from '@supabase/supabase-js';
import { fetchPropertyIqMetrics } from '../scoring/propertyiq-data-fetcher';
import { calculatePropertyIqScores } from '../scoring/propertyiq-scoring-engine';
import { GeographyLevel } from '../scoring/formula-weights';

const PAGE = 1000;

function getArg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
}

async function loadBackfillScores(
  supabase: any,
  geography: GeographyLevel,
  scoreDate: string,
): Promise<Map<string, { score: number; confidence_level: string }>> {
  const map = new Map<string, { score: number; confidence_level: string }>();
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('propertyiq_scores_v2')
      .select('location_id, score, confidence_level')
      .eq('score_type', 'propertyiq')
      .eq('geography', geography)
      .eq('score_date', scoreDate)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`backfill read failed: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const r of data as any[]) {
      map.set(String(r.location_id), {
        score: Number(r.score),
        confidence_level: String(r.confidence_level),
      });
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return map;
}

async function compareLevel(
  supabase: any,
  geography: GeographyLevel,
  scoreDate: string,
): Promise<void> {
  const locations = await fetchPropertyIqMetrics(
    supabase,
    geography,
    scoreDate,
  );
  const tsResults = calculatePropertyIqScores(locations, geography);
  const backfill = await loadBackfillScores(supabase, geography, scoreDate);

  let compared = 0;
  let within1 = 0;
  let exact = 0;
  let confAgree = 0;
  let tsOnly = 0;
  let backfillOnly = 0;
  const worst: { id: string; ts: number; bf: number }[] = [];

  const tsIds = new Set<string>();
  for (const r of tsResults) {
    tsIds.add(r.locationId);
    const bf = backfill.get(r.locationId);
    if (!bf) {
      tsOnly += 1;
      continue;
    }
    compared += 1;
    const diff = Math.abs(r.score - bf.score);
    if (diff <= 1) within1 += 1;
    if (diff === 0) exact += 1;
    else if (diff > 1)
      worst.push({ id: r.locationId, ts: r.score, bf: bf.score });
    if (r.confidenceLevel === bf.confidence_level) confAgree += 1;
  }
  for (const id of backfill.keys()) if (!tsIds.has(id)) backfillOnly += 1;

  const pct = (n: number) => ((100 * n) / Math.max(compared, 1)).toFixed(2);
  console.log(`\n[${geography}] date=${scoreDate}`);
  console.log(
    `  TS scored: ${tsResults.length}  backfill rows: ${backfill.size}`,
  );
  console.log(`  compared (in both): ${compared}`);
  console.log(
    `  within +/-1: ${within1} (${pct(within1)}%)  exact: ${exact} (${pct(exact)}%)`,
  );
  console.log(`  confidence agreement: ${confAgree} (${pct(confAgree)}%)`);
  console.log(`  TS-only: ${tsOnly}  backfill-only: ${backfillOnly}`);
  if (worst.length) {
    worst.sort((a, b) => Math.abs(b.ts - b.bf) - Math.abs(a.ts - a.bf));
    console.log(
      `  >1 diffs: ${worst.length}; worst: ` +
        worst
          .slice(0, 5)
          .map((w) => `${w.id}(ts${w.ts}/bf${w.bf})`)
          .join(', '),
    );
  }
  const passWithin1 = (100 * within1) / Math.max(compared, 1) >= 99;
  console.log(`  GATE within+/-1 >= 99%: ${passWithin1 ? 'PASS' : 'FAIL'}`);
}

async function main() {
  const scoreDate = getArg('date', '2026-04-30');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key)
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY missing');
  const supabase: any = createClient(url, key);

  const only = getArg('level', 'all');
  const levels = (
    only === 'all' ? ['metro', 'county', 'zip'] : [only]
  ) as GeographyLevel[];
  console.log(`Shadow-compare TS engine vs backfill @ ${scoreDate}`);
  for (const geo of levels) {
    await compareLevel(supabase, geo, scoreDate);
  }
  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
