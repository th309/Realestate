/**
 * Headless CLI: recompute the latest-month PropertyIQ scores for all geo levels.
 *
 * Usage:
 *   npx ts-node packages/backend/src/scripts/refresh-piq-scores.ts
 *   npx ts-node packages/backend/src/scripts/refresh-piq-scores.ts --date=2026-04-30
 *
 * Scores metro, county, and zip for the latest scorable month (min of latest
 * Zillow ZHVI + Realtor date) and upserts into propertyiq_scores_v2. Only the
 * latest period is (re)scored — never historical months.
 *
 * Boots a SLIM module (ScoringModule only), NOT the full AppModule. AppModule
 * instantiates every service — email, content-pipeline credential crypto, Stripe,
 * AI — each of which hard-requires env (PLATFORM_CREDENTIALS_ENCRYPTION_KEY,
 * OPENAI_API_KEY, ...) the scoring path never uses, so it crashes at DI in CI.
 * ScoringModule pulls in only Supabase + metric-resolution, so this boots with
 * just the DB credentials.
 *
 * Success gate for CI: output line starting with "TOTAL:". [FATAL] marks failure.
 */

// Load .env / .env.local before NestJS bootstrap so ConfigModule picks up
// secrets at injection time. In CI the workflow `env:` block already populates
// process.env; the `if (!process.env[key])` guard means CI-provided values are
// NOT overridden by the local files.
import { loadEnvFile } from './backfill-helpers';
loadEnvFile();
import * as fs from 'fs';
import * as path from 'path';
const envLocalPath = path.resolve(__dirname, '../../.env.local');
if (fs.existsSync(envLocalPath)) {
  const lines = fs.readFileSync(envLocalPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed
      .slice(eqIdx + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { SupabaseModule } from '../supabase/supabase.module';
import { MetricResolutionModule } from '../metric-resolution/metric-resolution.module';
import { ScoringService } from '../scoring/scoring.service';
import { CalibrationService } from '../scoring/calibration/calibration.service';
import { GeographyLevel } from '../scoring/formula-weights';

/**
 * Minimal context for the scoring CLI. ScoringService needs only the Supabase
 * client, CalibrationService (which has no deps of its own), and an @Optional
 * GeographyChainService (from MetricResolutionModule). Wiring those directly —
 * rather than importing the full ScoringModule — avoids ScoringModule's
 * FeaturesModule -> BillingModule -> StripeService / EmailModule chain, none of
 * which the scoring path uses, so the CLI boots with only DB credentials.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SupabaseModule,
    MetricResolutionModule,
  ],
  providers: [ScoringService, CalibrationService],
})
class ScoringCliModule {}

const GEO_LEVELS: GeographyLevel[] = ['metro', 'county', 'zip'];

async function main() {
  const start = Date.now();
  const app = await NestFactory.createApplicationContext(ScoringCliModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const svc = app.get(ScoringService);
    const dateArg = process.argv.find((a) => a.startsWith('--date='));
    const periodDate = dateArg ? dateArg.split('=')[1] : undefined;

    let total = 0;
    const failures: string[] = [];
    for (const geo of GEO_LEVELS) {
      try {
        const res = await svc.calculatePropertyIqScores(geo, periodDate);
        total += res.calculated;
        console.log(
          `  ${geo}: ${res.calculated} scored for ${res.scoreDate} (${res.errors} errors)`,
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        failures.push(`${geo}: ${msg}`);
        console.error(`  [ERROR] ${geo} scoring failed: ${msg}`);
      }
    }

    // One geo level throwing is tolerable (e.g. a zip-data lag) as long as some
    // scores landed. Zero rows across ALL levels is a hard failure, so the CI
    // gate never goes green on a fully empty run.
    if (total === 0) {
      console.error(
        '[FATAL] PropertyIQ scoring stored 0 rows across all geo levels — treating as failure',
      );
      if (failures.length) console.error(`  causes: ${failures.join('; ')}`);
      await app.close();
      process.exit(1);
    }

    if (failures.length) {
      console.warn(
        `[WARN] ${failures.length} geo level(s) failed but ${total} scores stored overall:`,
      );
      for (const f of failures) console.warn(`  - ${f}`);
    }

    console.log(
      `TOTAL: ${total} propertyiq_scores rows stored in ${((Date.now() - start) / 1000).toFixed(1)}s`,
    );
    await app.close();
    process.exit(0);
  } catch (err) {
    console.error('[FATAL] PropertyIQ scoring refresh failed:', err);
    await app.close();
    process.exit(1);
  }
}

void main();
