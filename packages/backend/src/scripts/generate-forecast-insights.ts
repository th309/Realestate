/**
 * Monthly post-rescore batch: pre-generates metro insights (market_take,
 * score_explanation, market_forecast) into market_insights so the /forecast
 * and /markets SEO pages serve cached narratives (cachedOnly=1) without ever
 * triggering live paid generation. Run from CI after refresh-piq-scores.
 *
 * Usage:
 *   npx ts-node packages/backend/src/scripts/generate-forecast-insights.ts
 *
 * Boots the full AppModule (unlike refresh-piq-scores.ts's slim
 * ScoringCliModule) because InsightsService needs AiProviderService and
 * NewsScoutService, which live behind AppModule's full DI graph. AppModule
 * also imports the @propertyiq workspace libs (emails, analyzer-core) via
 * dist/, so the CI job running this script MUST `npm run build:libs` first
 * or bootstrap fails with MODULE_NOT_FOUND (see post-import-refresh.yml).
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

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { InsightsService } from '../insights/insights.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const insights = app.get(InsightsService);
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
