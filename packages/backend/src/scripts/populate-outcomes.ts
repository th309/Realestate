/**
 * Populate PropertyIQ Backtest Outcomes
 *
 * Generates outcome data for all historical scores with benchmark comparisons.
 * Links each historical score to actual subsequent returns at 1Y, 3Y, 5Y horizons.
 *
 * Usage:
 *   npx ts-node packages/backend/src/scripts/populate-outcomes.ts
 *   npx ts-node packages/backend/src/scripts/populate-outcomes.ts --score-date=2021-01-01
 *   npx ts-node packages/backend/src/scripts/populate-outcomes.ts --geography=metro
 *   npx ts-node packages/backend/src/scripts/populate-outcomes.ts --start-date=2020-01-01 --end-date=2022-12-01
 *   npx ts-node packages/backend/src/scripts/populate-outcomes.ts --dry-run
 *
 * Arguments:
 *   --score-date     Single score date to process (YYYY-MM-DD)
 *   --start-date     Start date range (YYYY-MM-DD), defaults to earliest available
 *   --end-date       End date range (YYYY-MM-DD), defaults to 1 year ago
 *   --geography      Geography level (metro, county, zip), defaults to all
 *   --score-type     Score type (homeready, investoredge, markethealth), defaults to all
 *   --batch-size     Number of geographies per batch (default 100)
 *   --dry-run        Show what would be processed without actually doing it
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { OutcomeGeneratorService } from '../scoring/backtest/outcome-generator.service';
import { SupabaseService } from '../supabase/supabase.service';
import type { GeographyType, ScoreType } from '../scoring/scoring.types';

interface CliArgs {
  scoreDate: string | null;
  startDate: string | null;
  endDate: string | null;
  geography: GeographyType | 'all';
  scoreType: ScoreType | 'all';
  batchSize: number;
  dryRun: boolean;
}

function parseArgs(): CliArgs {
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
  console.log('║  PROPERTYIQ OUTCOME POPULATION                                    ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  Score Date:   ${args.scoreDate || 'All available dates'}`);
  console.log(`  Date Range:   ${args.startDate || 'earliest'} to ${args.endDate || '1Y ago'}`);
  console.log(`  Geography:    ${args.geography}`);
  console.log(`  Score Type:   ${args.scoreType}`);
  console.log(`  Batch Size:   ${args.batchSize}`);
  console.log(`  Dry Run:      ${args.dryRun}`);
  console.log('');

  // Initialize NestJS application
  console.log('  Initializing application...');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const outcomeService = app.get(OutcomeGeneratorService);
  const supabaseService = app.get(SupabaseService);
  const client = supabaseService.getClient();
  console.log('  Application initialized.');
  console.log('');

  // Determine which geographies and score types to process
  const geographies: GeographyType[] =
    args.geography === 'all' ? ['metro', 'county', 'zip'] : [args.geography];
  const scoreTypes: ScoreType[] =
    args.scoreType === 'all'
      ? ['homeready', 'investoredge', 'markethealth']
      : [args.scoreType];

  // Get list of score dates to process
  let scoreDates: string[] = [];

  if (args.scoreDate) {
    scoreDates = [args.scoreDate];
  } else {
    // Get all unique score dates from propertyiq_scores table
    // Default end date is 1 year ago (need 1Y of future data for outcomes)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const endDate = args.endDate || oneYearAgo.toISOString().slice(0, 10);

    const { data: dates, error } = await client
      .from('propertyiq_scores')
      .select('score_date')
      .lte('score_date', endDate)
      .order('score_date', { ascending: true });

    if (error) {
      console.error('Error fetching score dates:', error.message);
      process.exit(1);
    }

    // Get unique dates
    const uniqueDates = [...new Set(dates?.map((d: { score_date: string }) => d.score_date) || [])];

    // Filter by start date if specified
    if (args.startDate) {
      scoreDates = uniqueDates.filter(d => d >= args.startDate!);
    } else {
      scoreDates = uniqueDates;
    }
  }

  if (scoreDates.length === 0) {
    console.log('  No score dates found to process.');
    await app.close();
    process.exit(0);
  }

  console.log(`  Found ${scoreDates.length} score dates to process.`);
  console.log('');

  if (args.dryRun) {
    console.log('  DRY RUN - Would process these dates:');
    for (const date of scoreDates.slice(0, 10)) {
      console.log(`    - ${date}`);
    }
    if (scoreDates.length > 10) {
      console.log(`    ... and ${scoreDates.length - 10} more`);
    }
    console.log('');
    console.log('  Run without --dry-run to execute the population.');
    await app.close();
    process.exit(0);
  }

  console.log('══════════════════════════════════════════════════════════════════');
  console.log('  STARTING OUTCOME POPULATION');
  console.log('══════════════════════════════════════════════════════════════════');
  console.log('');

  const overallStartTime = Date.now();
  let totalProcessed = 0;
  let totalErrors = 0;
  let datesProcessed = 0;

  for (const scoreDate of scoreDates) {
    datesProcessed++;
    const dateStartTime = Date.now();
    const progress = `[${datesProcessed}/${scoreDates.length}]`;

    console.log(`  ${progress} Processing ${scoreDate}...`);

    for (const geography of geographies) {
      for (const scoreType of scoreTypes) {
        try {
          // Get all geographies with scores at this date
          const { data: scores, error: scoresError } = await client
            .from('propertyiq_scores')
            .select('location_id, score')
            .eq('geography', geography)
            .eq('score_type', scoreType)
            .eq('score_date', scoreDate)
            .not('score', 'is', null)
            .limit(args.batchSize * 10); // Get more to process in batches

          if (scoresError || !scores) {
            console.log(`    ${geography}/${scoreType}: No scores found`);
            continue;
          }

          // Process in batches
          let batchProcessed = 0;
          let batchErrors = 0;

          for (let i = 0; i < scores.length; i += args.batchSize) {
            const batch = scores.slice(i, i + args.batchSize);
            const outcomes = [];

            for (const score of batch) {
              try {
                const outcome = await outcomeService.generateOutcomesWithBenchmarks(
                  score.location_id,
                  geography as GeographyType,
                  scoreType,
                  scoreDate,
                );
                outcome.scoreValue = score.score;
                outcomes.push(outcome);
                batchProcessed++;
              } catch (err) {
                batchErrors++;
              }
            }

            // Save batch
            if (outcomes.length > 0) {
              await outcomeService.saveOutcomes(outcomes);
            }
          }

          totalProcessed += batchProcessed;
          totalErrors += batchErrors;

          if (batchProcessed > 0) {
            console.log(`    ${geography}/${scoreType}: ${batchProcessed} outcomes (${batchErrors} errors)`);
          }
        } catch (err) {
          console.error(`    ${geography}/${scoreType}: Error - ${err}`);
          totalErrors++;
        }
      }
    }

    const elapsed = formatElapsed(Date.now() - dateStartTime);
    console.log(`    Done (${elapsed})`);
    console.log('');
  }

  const totalElapsed = formatElapsed(Date.now() - overallStartTime);

  console.log('══════════════════════════════════════════════════════════════════');
  console.log('  OUTCOME POPULATION COMPLETE');
  console.log('══════════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`  Total dates processed:    ${datesProcessed}`);
  console.log(`  Total outcomes generated: ${totalProcessed.toLocaleString()}`);
  console.log(`  Total errors:             ${totalErrors}`);
  console.log(`  Total time:               ${totalElapsed}`);
  console.log('');

  // Show summary of outcomes
  console.log('  Outcomes by horizon availability:');
  for (const horizon of ['1y', '3y', '5y'] as const) {
    const colName = horizon === '1y' ? 'outcome_1y_value' : horizon === '3y' ? 'outcome_3y_value' : 'outcome_5y_value';
    const { count } = await client
      .from('propertyiq_backtest_outcomes')
      .select('*', { count: 'exact', head: true })
      .not(colName, 'is', null);
    console.log(`    ${horizon}: ${count?.toLocaleString() || 0} records`);
  }

  console.log('');
  console.log('  Outcomes with benchmarks:');
  const { count: withBenchmarks } = await client
    .from('propertyiq_backtest_outcomes')
    .select('*', { count: 'exact', head: true })
    .not('excess_vs_state_1y', 'is', null);
  console.log(`    With excess returns: ${withBenchmarks?.toLocaleString() || 0} records`);

  console.log('');

  await app.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
