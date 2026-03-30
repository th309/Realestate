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
 *   npx ts-node packages/backend/src/scripts/populate-outcomes.ts --dry-run
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { OutcomeGeneratorService } from '../scoring/backtest/outcome-generator.service';
import { OutcomeCacheService } from '../scoring/backtest/outcome-cache.service';
import { OutcomeCachePreloaderService } from '../scoring/backtest/outcome-cache-preloader.service';
import { SupabaseService } from '../supabase/supabase.service';
import type { GeographyType, ScoreType } from '../scoring/scoring.types';
import type { OutcomeRecord } from '../scoring/backtest/outcome-generator.types';
import {
  parseArgs,
  formatElapsed,
  fetchScoreDates,
} from './populate-outcomes-helpers';

async function main() {
  const args = parseArgs();

  console.log(
    '╔══════════════════════════════════════════════════════════════════╗',
  );
  console.log(
    '║  PROPERTYIQ OUTCOME POPULATION                                 ║',
  );
  console.log(
    '╚══════════════════════════════════════════════════════════════════╝',
  );
  console.log('');
  console.log(`  Score Date:   ${args.scoreDate || 'All available dates'}`);
  console.log(`  Geography:    ${args.geography}`);
  console.log(`  Score Type:   ${args.scoreType}`);
  console.log(`  Batch Size:   ${args.batchSize}`);
  console.log(`  Dry Run:      ${args.dryRun}`);
  console.log('');

  console.log('  Initializing application...');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  const outcomeService = app.get(OutcomeGeneratorService);
  const cacheService = app.get(OutcomeCacheService);
  const preloader = app.get(OutcomeCachePreloaderService);
  const client = app.get(SupabaseService).getClient();
  console.log('  Application initialized.');
  console.log('');

  const geographies: GeographyType[] =
    args.geography === 'all' ? ['metro', 'county', 'zip'] : [args.geography];
  const scoreTypes: ScoreType[] =
    args.scoreType === 'all' ? ['propertyiq'] : [args.scoreType];

  // Fetch score dates
  let scoreDates: string[];
  if (args.scoreDate) {
    scoreDates = [args.scoreDate];
  } else {
    const endDate = args.endDate || new Date().toISOString().slice(0, 10);
    scoreDates = await fetchScoreDates(client, endDate, args.startDate);
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
    for (const date of scoreDates.slice(0, 10)) console.log(`    - ${date}`);
    if (scoreDates.length > 10)
      console.log(`    ... and ${scoreDates.length - 10} more`);
    await app.close();
    process.exit(0);
  }

  // Bulk-preload caches — one full table scan per geography replaces
  // millions of individual per-outcome DB queries.
  console.log('  Pre-loading benchmark data (state + national)...');
  const bmCount = await cacheService.preloadBenchmarkData();
  console.log(`    → ${bmCount} benchmark entries cached`);
  for (const geography of geographies) {
    console.log(`  Pre-loading all Zillow ZHVI + ZORI for ${geography}...`);
    const histCount = await preloader.preloadHistoricalData(geography);
    console.log(`    → ${histCount} historical points...`);

    console.log(`  Pre-loading Redfin prices for ${geography}...`);
    const redfinCount = await preloader.preloadRedfinData(geography);
    console.log(`    → ${redfinCount} Redfin price points`);

    console.log(`  Pre-loading Realtor prices for ${geography}...`);
    const realtorCount = await preloader.preloadRealtorData(geography);
    console.log(`    → ${realtorCount} Realtor price points`);
  }
  console.log(
    `  Cache sizes: historical=${cacheService.historicalCache.size}, redfin=${cacheService.redfinCache.size}, realtor=${cacheService.realtorCache.size}, benchmark=${cacheService.benchmarkCache.size}, stateCode=${cacheService.stateCodeCache.size}`,
  );
  // Quick cache-hit diagnostic
  const testHit = cacheService.lookupHistorical('metro', '31080', '2021-02-01');
  console.log(
    `  Cache test (metro:31080:2021-02-01): ${testHit === undefined ? 'MISS (not preloaded)' : testHit === null ? 'null (no data)' : `HIT zhvi=${testHit[0]?.zhvi} zori=${testHit[0]?.zori}`}`,
  );
  console.log(
    `  Cache test ZORI (metro:31080): zhvi=${testHit?.[0]?.zhvi ?? 'N/A'} zori=${testHit?.[0]?.zori ?? 'N/A'}`,
  );
  console.log('  Pre-loading complete.\n');

  console.log(
    '══════════════════════════════════════════════════════════════════',
  );
  console.log('  STARTING OUTCOME POPULATION');
  console.log(
    '══════════════════════════════════════════════════════════════════\n',
  );

  const overallStartTime = Date.now();
  let totalProcessed = 0;
  let totalErrors = 0;

  for (let d = 0; d < scoreDates.length; d++) {
    const scoreDate = scoreDates[d];
    const dateStartTime = Date.now();
    console.log(`  [${d + 1}/${scoreDates.length}] Processing ${scoreDate}...`);

    for (const geography of geographies) {
      for (const scoreType of scoreTypes) {
        try {
          const scores = await fetchScoresForDate(
            client,
            geography,
            scoreType,
            scoreDate,
          );
          if (scores.length === 0) continue;

          let processed = 0;
          let errors = 0;
          const totalBatches = Math.ceil(scores.length / args.batchSize);

          console.log(
            `    ${geography}/${scoreType}: ${scores.length} scores → ${totalBatches} batches`,
          );

          for (let i = 0; i < scores.length; i += args.batchSize) {
            const batch = scores.slice(i, i + args.batchSize);
            const batchNum = Math.floor(i / args.batchSize) + 1;

            const results = await Promise.allSettled(
              batch.map((score) =>
                outcomeService.generateOutcomesWithBenchmarks(
                  score.location_id,
                  geography,
                  scoreType,
                  scoreDate,
                  ['1y', '3y', '5y'],
                  score.score,
                ),
              ),
            );

            const outcomes: OutcomeRecord[] = [];
            for (const r of results) {
              if (r.status === 'fulfilled') {
                outcomes.push(r.value);
                processed++;
              } else {
                errors++;
              }
            }

            if (outcomes.length > 0)
              await outcomeService.saveOutcomes(outcomes);

            if (batchNum % 10 === 0 || batchNum === totalBatches) {
              const pct = ((batchNum / totalBatches) * 100).toFixed(0);
              console.log(
                `      batch ${batchNum}/${totalBatches} (${pct}%) — ${processed} ok, ${errors} err`,
              );
            }
          }

          totalProcessed += processed;
          totalErrors += errors;
          if (processed > 0) {
            console.log(
              `    ${geography}/${scoreType}: ${processed} outcomes (${errors} errors)`,
            );
          }
        } catch (err) {
          console.error(`    ${geography}/${scoreType}: Error - ${err}`);
          totalErrors++;
        }
      }
    }

    console.log(`    Done (${formatElapsed(Date.now() - dateStartTime)})\n`);
  }

  console.log(
    '══════════════════════════════════════════════════════════════════',
  );
  console.log('  OUTCOME POPULATION COMPLETE');
  console.log(
    '══════════════════════════════════════════════════════════════════\n',
  );
  console.log(`  Total dates processed:    ${scoreDates.length}`);
  console.log(`  Total outcomes generated: ${totalProcessed.toLocaleString()}`);
  console.log(`  Total errors:             ${totalErrors}`);
  console.log(
    `  Total time:               ${formatElapsed(Date.now() - overallStartTime)}\n`,
  );

  await app.close();
  process.exit(0);
}

/** Paginate through all scores for a given geography/scoreType/date */
async function fetchScoresForDate(
  client: ReturnType<SupabaseService['getClient']>,
  geography: GeographyType,
  scoreType: ScoreType,
  scoreDate: string,
): Promise<Array<{ location_id: string; score: number }>> {
  const scores: Array<{ location_id: string; score: number }> = [];
  let rangeStart = 0;
  const pageSize = 1000;

  while (true) {
    const { data: page, error } = await client
      .from('propertyiq_scores_v2')
      .select('location_id, score')
      .eq('geography', geography)
      .eq('score_type', scoreType)
      .eq('score_date', scoreDate)
      .not('score', 'is', null)
      .range(rangeStart, rangeStart + pageSize - 1);

    if (error || !page || page.length === 0) break;
    scores.push(...page);
    if (page.length < pageSize) break;
    rangeStart += pageSize;
  }

  return scores;
}

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
  process.exit(1);
});

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
