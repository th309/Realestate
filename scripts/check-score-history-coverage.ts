/**
 * Check how many score records exist per geography and how far back they go.
 * Reports: distinct score_dates, min/max date, months of history, and row counts per date.
 *
 * Run from repo root:
 *   npx ts-node scripts/check-score-history-coverage.ts
 * Or:
 *   node --loader ts-node/esm scripts/check-score-history-coverage.ts
 */

import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: 'packages/frontend/.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const GEOGRAPHIES = ['metro', 'county', 'zip'] as const;
const MAX_DATES_TO_FETCH = 120; // cap iteration (e.g. 10 years monthly)

function monthsBetween(d1: string, d2: string): number {
  const a = new Date(d1);
  const b = new Date(d2);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

async function getDistinctScoreDates(geography: string): Promise<string[]> {
  const dates: string[] = [];
  let currentMax: string | null = null;

  for (let i = 0; i < MAX_DATES_TO_FETCH; i++) {
    let query = supabase
      .from('propertyiq_scores')
      .select('score_date')
      .eq('geography', geography)
      .order('score_date', { ascending: false })
      .limit(1);

    if (currentMax) {
      query = query.lt('score_date', currentMax);
    }

    const { data, error } = await query.maybeSingle();
    if (error || !data) break;

    const nextDate = data.score_date as string;
    if (dates.length && nextDate === dates[dates.length - 1]) break;
    dates.push(nextDate);
    currentMax = nextDate;
  }

  return dates.sort((a, b) => a.localeCompare(b));
}

async function getRowCountForDate(geography: string, scoreDate: string): Promise<number> {
  const { count, error } = await supabase
    .from('propertyiq_scores')
    .select('*', { count: 'exact', head: true })
    .eq('geography', geography)
    .eq('score_date', scoreDate);
  if (error) return 0;
  return count ?? 0;
}

async function main() {
  console.log('=== PropertyIQ score history coverage ===\n');

  for (const geo of GEOGRAPHIES) {
    const { count: totalCount, error: countErr } = await supabase
      .from('propertyiq_scores')
      .select('*', { count: 'exact', head: true })
      .eq('geography', geo);

    if (countErr) {
      console.log(`${geo}: Error - ${countErr.message}\n`);
      continue;
    }

    const dates = await getDistinctScoreDates(geo);
    const minDate = dates[0] ?? null;
    const maxDate = dates[dates.length - 1] ?? null;
    const monthsBack = minDate && maxDate ? monthsBetween(minDate, maxDate) : 0;

    console.log(`--- ${geo.toUpperCase()} ---`);
    console.log(`  Total rows:        ${(totalCount ?? 0).toLocaleString()}`);
    console.log(`  Distinct dates:    ${dates.length}`);
    console.log(`  Date range:        ${minDate ?? 'n/a'}  →  ${maxDate ?? 'n/a'}`);
    console.log(`  Months of history: ${monthsBack} (${dates.length} score dates)`);

    if (dates.length > 0) {
      const latestDate = dates[dates.length - 1];
      const latestCount = await getRowCountForDate(geo, latestDate);
      const oldestDate = dates[0];
      const oldestCount = await getRowCountForDate(geo, oldestDate);
      console.log(`  Latest date (${latestDate}) row count: ${latestCount.toLocaleString()}`);
      console.log(`  Oldest date (${oldestDate}) row count: ${oldestCount.toLocaleString()}`);
    }

    if (dates.length <= 10 && dates.length > 0) {
      console.log(`  All dates: ${dates.join(', ')}`);
    } else if (dates.length > 10) {
      console.log(`  First 5: ${dates.slice(0, 5).join(', ')}`);
      console.log(`  Last 5:  ${dates.slice(-5).join(', ')}`);
    }

    console.log('');
  }

  console.log('--- Summary for 3‑month trend ---');
  console.log('Backend sets trend_change only when ≥2 score_dates exist for that geography.');
  console.log('If "Distinct dates" is 1 for a geography, the UI will show "--" for 3‑month change.\n');
}

main().catch(console.error);
