/**
 * Populate Outcomes — CLI Helpers
 *
 * Argument parsing, date fetching, and formatting for populate-outcomes script.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { GeographyType, ScoreType } from '../scoring/scoring.types';

export interface CliArgs {
  scoreDate: string | null;
  startDate: string | null;
  endDate: string | null;
  geography: GeographyType | 'all';
  scoreType: ScoreType | 'all';
  batchSize: number;
  dryRun: boolean;
}

export function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = {
    scoreDate: null,
    startDate: null,
    endDate: null,
    geography: 'all',
    scoreType: 'all',
    batchSize: 100,
    dryRun: false,
  };

  for (const arg of args) {
    if (arg.startsWith('--score-date=')) {
      result.scoreDate = arg.replace('--score-date=', '');
    } else if (arg.startsWith('--start-date=')) {
      result.startDate = arg.replace('--start-date=', '');
    } else if (arg.startsWith('--end-date=')) {
      result.endDate = arg.replace('--end-date=', '');
    } else if (arg.startsWith('--geography=')) {
      const geo = arg.replace('--geography=', '').toLowerCase();
      if (['metro', 'county', 'zip', 'all'].includes(geo)) {
        result.geography = geo as GeographyType | 'all';
      }
    } else if (arg.startsWith('--score-type=')) {
      const st = arg.replace('--score-type=', '').toLowerCase();
      if (['homeready', 'investoredge', 'markethealth', 'all'].includes(st)) {
        result.scoreType = st as ScoreType | 'all';
      }
    } else if (arg.startsWith('--batch-size=')) {
      result.batchSize = parseInt(arg.replace('--batch-size=', ''), 10) || 100;
    } else if (arg === '--dry-run') {
      result.dryRun = true;
    }
  }

  return result;
}

export function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

/**
 * Fetch all unique score dates from the v2 table, paginating past the 1000-row limit.
 */
export async function fetchScoreDates(
  client: SupabaseClient,
  endDate: string,
  startDate: string | null,
): Promise<string[]> {
  const allDates = new Set<string>();
  let cursor: string | null = null;

  while (true) {
    let query = client
      .from('propertyiq_scores_v2')
      .select('score_date')
      .lte('score_date', endDate)
      .order('score_date', { ascending: true })
      .limit(1000);

    if (cursor) {
      query = query.gt('score_date', cursor);
    }

    const { data: page, error } = await query;

    if (error) {
      console.error('Error fetching score dates:', error.message);
      process.exit(1);
    }

    if (!page || page.length === 0) break;

    for (const row of page) {
      allDates.add(row.score_date);
    }

    const lastDate = page[page.length - 1].score_date;
    if (lastDate === cursor) break;
    cursor = lastDate;
  }

  const uniqueDates = [...allDates].sort();
  if (startDate) {
    return uniqueDates.filter((d) => d >= startDate);
  }
  return uniqueDates;
}
