/**
 * Backfill Historical PropertyIQ Scores
 *
 * Usage:
 *   npx ts-node packages/backend/src/scripts/backfill-historical-scores.ts
 *   npx ts-node packages/backend/src/scripts/backfill-historical-scores.ts --start-date=2025-12-01 --end-date=2026-01-01
 *   npx ts-node packages/backend/src/scripts/backfill-historical-scores.ts --geography=metro
 *   npx ts-node packages/backend/src/scripts/backfill-historical-scores.ts --dry-run
 *   npx ts-node packages/backend/src/scripts/backfill-historical-scores.ts --reset-checkpoint
 *
 * Checkpoint: Saves progress after each geo+date task. Re-run to resume.
 */

import {
  loadEnvFile,
  parseBackfillArgs,
  normalizeToMonthStart,
  getDefaultStartDate,
  generateMonthlyDates,
  generateQuarterlyDates,
  formatElapsed,
  getCheckpointPath,
  loadCheckpoint,
  saveCheckpoint,
  clearCheckpoint,
} from './backfill-helpers';

// Load .env before NestJS bootstrap (ConfigModule needs these at injection time)
loadEnvFile();

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ScoringService } from '../scoring/scoring.service';
import { GeographyLevel } from '../scoring/formula-weights';

const CHECKPOINT = getCheckpointPath('backfill-scores');

async function main() {
  const args = parseBackfillArgs();
  const normalizedEndDate = normalizeToMonthStart(args.endDate);
  const startDate = args.startDate
    ? normalizeToMonthStart(args.startDate)
    : getDefaultStartDate(normalizedEndDate, args.years ?? 5);

  console.log('');
  console.log('  PROPERTYIQ HISTORICAL SCORE BACKFILL');
  console.log(
    `  ${startDate} → ${normalizedEndDate} | geo: ${args.geography} | zip-freq: ${args.zipFrequency}`,
  );
  console.log('');

  if (args.resetCheckpoint) {
    clearCheckpoint(CHECKPOINT);
    console.log('  Checkpoint cleared.');
  }

  const geographies: GeographyLevel[] =
    args.geography === 'all' ? ['metro', 'county', 'zip'] : [args.geography];

  const geoDateLists = new Map<GeographyLevel, string[]>();
  const geoDateSets = new Map<GeographyLevel, Set<string>>();

  for (const geo of geographies) {
    const dates =
      geo === 'zip' && args.zipFrequency === 'quarterly'
        ? generateQuarterlyDates(startDate, normalizedEndDate)
        : generateMonthlyDates(startDate, normalizedEndDate);
    geoDateLists.set(geo, dates);
    geoDateSets.set(geo, new Set(dates));
  }

  const allDates = [...new Set(Array.from(geoDateLists.values()).flat())].sort(
    (a, b) => a.localeCompare(b),
  );

  const totalTasks = Array.from(geoDateLists.values()).reduce(
    (s, d) => s + d.length,
    0,
  );
  for (const geo of geographies) {
    console.log(`  ${geo}: ${geoDateLists.get(geo)?.length ?? 0} periods`);
  }
  console.log(`  Total tasks: ${totalTasks}`);
  console.log('');

  if (args.dryRun) {
    console.log(
      '  DRY RUN — would process the dates above. Run without --dry-run to execute.',
    );
    process.exit(0);
  }

  console.log('  Initializing application...');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const scoringService = app.get(ScoringService);
  console.log('  Ready.\n');

  const completed = loadCheckpoint(CHECKPOINT);
  if (completed.size > 0) {
    console.log(`  Resuming: ${completed.size} tasks already done\n`);
  }

  const t0 = Date.now();
  let totalCalculated = 0;
  let totalErrors = 0;
  let skipped = 0;
  let idx = 0;
  const failedPeriods: string[] = [];

  for (const date of allDates) {
    const geosForDate = geographies.filter((g) =>
      geoDateSets.get(g)?.has(date),
    );
    if (geosForDate.length === 0) continue;
    idx++;
    const t1 = Date.now();
    process.stdout.write(`  [${idx}/${allDates.length}] ${date}: `);

    let periodCalc = 0;
    let periodErr = 0;
    const parts: string[] = [];

    for (const geo of geosForDate) {
      const key = `${geo}:${date}`;
      if (completed.has(key)) {
        parts.push(`${geo}:SKIP`);
        skipped++;
        continue;
      }

      try {
        const r = await scoringService.calculateAllScores(geo, date);
        periodCalc += r.calculated;
        periodErr += r.errors;
        parts.push(`${geo}:${r.calculated}`);
        completed.add(key);
        saveCheckpoint(CHECKPOINT, completed);
      } catch (err) {
        periodErr++;
        parts.push(`${geo}:ERR`);
        console.error(`\n    Error ${geo}@${date}:`, err);
      }
    }

    totalCalculated += periodCalc;
    totalErrors += periodErr;
    console.log(`${parts.join(', ')} (${formatElapsed(Date.now() - t1)})`);

    if (periodErr > 0 && periodCalc === 0) failedPeriods.push(date);
  }

  console.log('');
  console.log('  BACKFILL COMPLETE');
  console.log(
    `  Scored: ${totalCalculated.toLocaleString()} | Skipped: ${skipped} | Errors: ${totalErrors} | Time: ${formatElapsed(Date.now() - t0)}`,
  );

  if (failedPeriods.length > 0) {
    console.log(`  Failed: ${failedPeriods.slice(0, 10).join(', ')}`);
  }
  console.log('');

  await app.close();
  process.exit(failedPeriods.length > Math.max(1, idx) / 2 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
