/**
 * Backfill Historical PropertyIQ Scores
 *
 * Generates PropertyIQ scores for every month from a start date to end date.
 * This enables historical score tracking and outcome validation.
 *
 * Usage:
 *   npx ts-node packages/backend/src/scripts/backfill-historical-scores.ts
 *   npx ts-node packages/backend/src/scripts/backfill-historical-scores.ts --years=5
 *   npx ts-node packages/backend/src/scripts/backfill-historical-scores.ts --start-date=2020-01-01 --end-date=2024-12-01
 *   npx ts-node packages/backend/src/scripts/backfill-historical-scores.ts --geography=metro
 *   npx ts-node packages/backend/src/scripts/backfill-historical-scores.ts --zip-frequency=monthly
 *   npx ts-node packages/backend/src/scripts/backfill-historical-scores.ts --dry-run
 *
 * Arguments:
 *   --start-date      Start date (YYYY-MM-DD format), defaults to 5 years ago
 *   --end-date        End date (YYYY-MM-DD format), defaults to current month
 *   --years           Convenience: sets start-date to N years before end-date (ignored if start-date provided)
 *   --geography       Geography level (metro, county, zip), defaults to all
 *   --zip-frequency   Zip cadence: monthly or quarterly (default quarterly)
 *   --dry-run         Show what would be calculated without actually doing it
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ScoringService } from '../scoring/scoring.service';
import { GeographyLevel } from '../scoring/formula-weights';

interface CliArgs {
  startDate: string | null;
  endDate: string;
  years: number | null;
  geography: GeographyLevel | 'all';
  zipFrequency: 'monthly' | 'quarterly';
  dryRun: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = {
    endDate: new Date().toISOString().slice(0, 10),
    startDate: null,
    years: 5,
    geography: 'all',
    zipFrequency: 'quarterly',
    dryRun: false,
  };

  for (const arg of args) {
    if (arg.startsWith('--start-date=')) {
      result.startDate = arg.replace('--start-date=', '');
    } else if (arg.startsWith('--end-date=')) {
      result.endDate = arg.replace('--end-date=', '');
    } else if (arg.startsWith('--years=')) {
      const years = parseInt(arg.replace('--years=', ''), 10);
      result.years = Number.isFinite(years) && years > 0 ? years : result.years;
    } else if (arg.startsWith('--geography=')) {
      const geo = arg.replace('--geography=', '').toLowerCase();
      if (['metro', 'county', 'zip', 'all'].includes(geo)) {
        result.geography = geo as GeographyLevel | 'all';
      }
    } else if (arg.startsWith('--zip-frequency=')) {
      const freq = arg.replace('--zip-frequency=', '').toLowerCase();
      if (freq === 'monthly' || freq === 'quarterly') {
        result.zipFrequency = freq;
      }
    } else if (arg === '--dry-run') {
      result.dryRun = true;
    }
  }

  return result;
}

/**
 * Generate array of monthly dates between start and end
 */
function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

function formatMonthStart(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-01`;
}

function generateMonthlyDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Normalize to first of month
  start.setDate(1);
  end.setDate(1);

  const current = new Date(start);
  while (current <= end) {
    dates.push(formatMonthStart(current));
    current.setMonth(current.getMonth() + 1);
  }

  return dates;
}

/**
 * Generate array of quarterly dates between start and end.
 * Starts at the next quarter boundary on or after startDate.
 */
function generateQuarterlyDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Normalize to first of month
  start.setDate(1);
  end.setDate(1);

  const startQuarterMonth = Math.floor(start.getMonth() / 3) * 3;
  const quarterStart = new Date(start.getFullYear(), startQuarterMonth, 1);
  if (quarterStart < start) {
    quarterStart.setMonth(quarterStart.getMonth() + 3);
  }

  const current = new Date(quarterStart);
  while (current <= end) {
    dates.push(formatMonthStart(current));
    current.setMonth(current.getMonth() + 3);
  }

  return dates;
}

function normalizeToMonthStart(dateStr: string): string {
  const date = new Date(dateStr);
  date.setDate(1);
  return formatMonthStart(date);
}

function getDefaultStartDate(endDate: string, years: number): string {
  const end = new Date(endDate);
  end.setDate(1);
  const start = new Date(end);
  start.setFullYear(start.getFullYear() - years);
  return formatMonthStart(start);
}

/**
 * Format elapsed time in human-readable format
 */
function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

async function main() {
  const args = parseArgs();
  const normalizedEndDate = normalizeToMonthStart(args.endDate);
  const startDate = args.startDate
    ? normalizeToMonthStart(args.startDate)
    : getDefaultStartDate(normalizedEndDate, args.years ?? 5);

  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║  PROPERTYIQ HISTORICAL SCORE BACKFILL                             ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  Start Date:  ${startDate}${args.startDate ? '' : ' (auto)'}`);
  console.log(`  End Date:    ${normalizedEndDate}${normalizedEndDate !== args.endDate ? ' (normalized)' : ''}`);
  console.log(`  Years:       ${args.years ?? 'n/a'}`);
  console.log(`  Geography:   ${args.geography}`);
  console.log(`  Zip Freq:    ${args.zipFrequency}`);
  console.log(`  Dry Run:     ${args.dryRun}`);
  console.log('');

  // Determine which geographies to process
  const geographies: GeographyLevel[] =
    args.geography === 'all'
      ? ['metro', 'county', 'zip']
      : [args.geography as GeographyLevel];

  const geoDateLists = new Map<GeographyLevel, string[]>();
  const geoDateSets = new Map<GeographyLevel, Set<string>>();
  let totalTasks = 0;

  for (const geo of geographies) {
    const dates = geo === 'zip' && args.zipFrequency === 'quarterly'
      ? generateQuarterlyDates(startDate, normalizedEndDate)
      : generateMonthlyDates(startDate, normalizedEndDate);
    geoDateLists.set(geo, dates);
    geoDateSets.set(geo, new Set(dates));
    totalTasks += dates.length;
  }

  const allDates = [...new Set(Array.from(geoDateLists.values()).flat())].sort(
    (a, b) => a.localeCompare(b),
  );

  console.log('  Periods to process by geography:');
  for (const geo of geographies) {
    const count = geoDateLists.get(geo)?.length ?? 0;
    console.log(`    - ${geo}: ${count}`);
  }
  console.log(`  Total date/geography tasks: ${totalTasks}`);
  console.log('');

  if (args.dryRun) {
    console.log('  DRY RUN - Would process these dates:');
    for (const geo of geographies) {
      const dates = geoDateLists.get(geo) ?? [];
      console.log(`    ${geo}:`);
      for (const date of dates.slice(0, 6)) {
        console.log(`      - ${date}`);
      }
      if (dates.length > 6) {
        console.log(`      ... and ${dates.length - 6} more`);
      }
    }
    console.log('');
    console.log('  Run without --dry-run to execute the backfill.');
    process.exit(0);
  }

  // Initialize NestJS application
  console.log('  Initializing application...');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const scoringService = app.get(ScoringService);
  console.log('  Application initialized.');
  console.log('');

  console.log('══════════════════════════════════════════════════════════════════');
  console.log('  STARTING BACKFILL');
  console.log('══════════════════════════════════════════════════════════════════');
  console.log('');

  const overallStartTime = Date.now();
  let totalCalculated = 0;
  let totalErrors = 0;
  let datesProcessed = 0;
  let tasksProcessed = 0;
  const failedPeriods: string[] = [];

  for (const date of allDates) {
    const geosForDate = geographies.filter(g => geoDateSets.get(g)?.has(date));
    if (geosForDate.length === 0) continue;
    datesProcessed++;
    const periodStartTime = Date.now();
    const progress = `[${datesProcessed}/${allDates.length}]`;

    process.stdout.write(`  ${progress} ${date}: `);

    let periodCalculated = 0;
    let periodErrors = 0;
    const geoResults: string[] = [];

    for (const geography of geosForDate) {
      try {
        const result = await scoringService.calculateAllScores(geography, date);
        periodCalculated += result.calculated;
        periodErrors += result.errors;
        geoResults.push(`${geography}:${result.calculated}`);
        tasksProcessed++;
      } catch (err) {
        periodErrors++;
        geoResults.push(`${geography}:ERR`);
        console.error(`\n    Error for ${geography} at ${date}:`, err);
        tasksProcessed++;
      }
    }

    totalCalculated += periodCalculated;
    totalErrors += periodErrors;

    const elapsed = formatElapsed(Date.now() - periodStartTime);
    console.log(`${geoResults.join(', ')} (${elapsed})`);

    if (periodErrors > 0 && periodCalculated === 0) {
      failedPeriods.push(date);
    }
  }

  const totalElapsed = formatElapsed(Date.now() - overallStartTime);

  console.log('');
  console.log('══════════════════════════════════════════════════════════════════');
  console.log('  BACKFILL COMPLETE');
  console.log('══════════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`  Total dates processed:   ${datesProcessed}`);
  console.log(`  Total tasks processed:   ${tasksProcessed}`);
  console.log(`  Total scores calculated: ${totalCalculated.toLocaleString()}`);
  console.log(`  Total errors:           ${totalErrors}`);
  console.log(`  Total time:             ${totalElapsed}`);
  console.log('');

  if (failedPeriods.length > 0) {
    console.log('  Failed periods (no scores calculated):');
    for (const p of failedPeriods.slice(0, 10)) {
      console.log(`    - ${p}`);
    }
    if (failedPeriods.length > 10) {
      console.log(`    ... and ${failedPeriods.length - 10} more`);
    }
    console.log('');
    console.log('  Note: Failed periods may be due to missing source data.');
  }

  console.log('');
  console.log('  The backfill uses UPSERT, so you can safely re-run for any period.');
  console.log('');

  await app.close();
  const failureThreshold = Math.max(1, datesProcessed) / 2;
  process.exit(failedPeriods.length > failureThreshold ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
