/**
 * Monthly post-rescore batch: pre-generates metro insights (market_take,
 * score_explanation, market_forecast) into market_insights so the /forecast
 * and /markets SEO pages serve cached narratives (cachedOnly=1) without ever
 * triggering live paid generation. Run from CI after refresh-piq-scores.
 *
 * Usage:
 *   npx ts-node packages/backend/src/scripts/generate-forecast-insights.ts
 *   npx ts-node packages/backend/src/scripts/generate-forecast-insights.ts --boot-check
 *
 * Boots a SLIM module (InsightsCliModule), NOT the full AppModule. AppModule
 * imports ContentPipelineModule, whose eager CredentialCrypto provider throws
 * at DI boot when PLATFORM_CREDENTIALS_ENCRYPTION_KEY is unset — the CI job
 * running this script doesn't set that key, so booting AppModule crashed
 * before generating anything. InsightsCliModule wires only what
 * InsightsService actually needs (Supabase, ScoringService +
 * CalibrationService direct-wired like refresh-piq-scores.ts's
 * ScoringCliModule, MetricResolutionModule, AiProviderModule, NewsScoutService)
 * so it boots with just DB + AI credentials.
 *
 * `--boot-check`: create the DI context, resolve InsightsService, log
 * "boot-check OK", and exit 0 WITHOUT generating (no paid AI calls). Use this
 * to verify the module graph boots in CI/locally without spending money.
 */

// Load .env / .env.local before NestJS bootstrap so ConfigModule picks up
// secrets at injection time. In CI the workflow `env:` block already populates
// process.env; the `if (!process.env[key])` guard means CI-provided values are
// NOT overridden by the local files. Mirrors refresh-piq-scores.ts exactly.
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
import { AiProviderModule } from '../ai-provider/ai-provider.module';
import { ScoringService } from '../scoring/scoring.service';
import { CalibrationService } from '../scoring/calibration/calibration.service';
import { NewsScoutService } from '../reports/news-scout.service';
import { InsightsService } from '../insights/insights.service';

/**
 * Minimal context for the insights CLI. InsightsService's constructor needs:
 * SUPABASE_CLIENT (SupabaseModule), ScoringService + CalibrationService
 * (direct-wired here rather than importing ScoringModule, which drags in
 * FeaturesModule -> BillingModule -> StripeService / EmailModule — the same
 * avoidance ScoringCliModule in refresh-piq-scores.ts uses),
 * MetricResolutionService + GeographyChainService (MetricResolutionModule),
 * AiProviderService (AiProviderModule, @Global but still imported explicitly
 * for clarity — mirrors app.module.ts), and NewsScoutService (direct-wired;
 * only needs SupabaseService + AiProviderService, both already in scope).
 *
 * This deliberately does NOT import AppModule or ContentPipelineModule, so
 * PLATFORM_CREDENTIALS_ENCRYPTION_KEY is never required to boot.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SupabaseModule,
    MetricResolutionModule,
    AiProviderModule,
  ],
  providers: [
    InsightsService,
    ScoringService,
    CalibrationService,
    NewsScoutService,
  ],
})
class InsightsCliModule {}

async function main() {
  const bootCheckOnly = process.argv.includes('--boot-check');
  const app = await NestFactory.createApplicationContext(InsightsCliModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const insights = app.get(InsightsService);

    if (bootCheckOnly) {
      console.log('[forecast-insights] boot-check OK');
      return;
    }

    const result = await insights.generateBatchInsights('metro');
    console.log(
      `[forecast-insights] generated=${result.generated} failed=${result.failed} duration_ms=${result.duration_ms}`,
    );
    // Loud-failure guard (see project lesson on silent CI success): a run where
    // nothing generated AND something failed is an error, not a green no-op.
    if (result.generated === 0 && result.failed > 0) {
      throw new Error('Batch generated nothing and reported failures');
    }
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
