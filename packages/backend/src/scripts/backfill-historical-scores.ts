/**
 * Backfill Historical PropertyIQ Scores
 *
 * Generates PropertyIQ scores for every month from a start date to end date.
 * This enables historical score tracking and outcome validation.
 *
 * Usage:
 *   npx ts-node packages/backend/src/scripts/backfill-historical-scores.ts
 *   npx ts-node packages/backend/src/scripts/backfill-historical-scores.ts --start-date=2020-01-01 --end-date=2024-12-01
 *   npx ts-node packages/backend/src/scripts/backfill-historical-scores.ts --geography=metro
 *   npx ts-node packages/backend/src/scripts/backfill-historical-scores.ts --dry-run
 *
 * Arguments:
 *   --start-date    Start date (YYYY-MM-DD format), defaults to 2020-01-01
 *   --end-date      End date (YYYY-MM-DD format), defaults to current month
 *   --geography     Geography level (metro, county, zip), defaults to all
 *   --dry-run       Show what would be calculated without actually doing it
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ScoringService } from '../scoring/scoring.service';
import { GeographyLevel } from '../scoring/formula-weights';

interface CliArgs {
  startDate: string;
  endDate: string;
  geography: GeographyLevel | 'all';
  dryRun: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = {
    startDate: '2020-01-01',
    endDate: new Date().toISOString().slice(0, 10),
    geography: 'all',
    dryRun: false,
  };

  for (const arg of args) {
    if (arg.startsWith('--start-date=')) {
      result.startDate = arg.replace('--start-date=', '');
    } else if (arg.startsWith('--end-date=')) {
      result.endDate = arg.replace('--end-date=', '');
    } else if (arg.startsWith('--geography=')) {
      const geo = arg.replace('--geography=', '').toLowerCase();
      if (['metro', 'county', 'zip', 'all'].includes(geo)) {
        result.geography = geo as GeographyLevel | 'all';
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
function generateMonthlyDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Normalize to first of month
  start.setDate(1);
  end.setDate(1);

  const current = new Date(start);
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setMonth(current.getMonth() + 1);
  }

  return dates;
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

  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║  PROPERTYIQ HISTORICAL SCORE BACKFILL                             ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  Start Date:  ${args.startDate}`);
  console.log(`  End Date:    ${args.endDate}`);
  console.log(`  Geography:   ${args.geography}`);
  console.log(`  Dry Run:     ${args.dryRun}`);
  console.log('');

  // Generate list of monthly dates
  const dates = generateMonthlyDates(args.startDate, args.endDate);
  console.log(`  Total periods to process: ${dates.length}`);
  console.log('');

  if (args.dryRun) {
    console.log('  DRY RUN - Would process these dates:');
    for (const date of dates.slice(0, 10)) {
      console.log(`    - ${date}`);
    }
    if (dates.length > 10) {
      console.log(`    ... and ${dates.length - 10} more`);
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

  // Determine which geographies to process
  const geographies: GeographyLevel[] =
    args.geography === 'all'
      ? ['metro', 'county', 'zip']
      : [args.geography as GeographyLevel];

  console.log('══════════════════════════════════════════════════════════════════');
  console.log('  STARTING BACKFILL');
  console.log('══════════════════════════════════════════════════════════════════');
  console.log('');

  const overallStartTime = Date.now();
  let totalCalculated = 0;
  let totalErrors = 0;
  let periodsProcessed = 0;
  const failedPeriods: string[] = [];

  for (const date of dates) {
    periodsProcessed++;
    const periodStartTime = Date.now();
    const progress = `[${periodsProcessed}/${dates.length}]`;

    process.stdout.write(`  ${progress} ${date}: `);

    let periodCalculated = 0;
    let periodErrors = 0;
    const geoResults: string[] = [];

    for (const geography of geographies) {
      try {
        const result = await scoringService.calculateAllScores(geography, date);
        periodCalculated += result.calculated;
        periodErrors += result.errors;
        geoResults.push(`${geography}:${result.calculated}`);
      } catch (err) {
        periodErrors++;
        geoResults.push(`${geography}:ERR`);
        console.error(`\n    Error for ${geography} at ${date}:`, err);
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
  console.log(`  Total periods processed: ${periodsProcessed}`);
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
  process.exit(failedPeriods.length > dates.length / 2 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
