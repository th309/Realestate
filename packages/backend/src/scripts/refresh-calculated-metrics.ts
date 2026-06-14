/**
 * Headless CLI: run the monthly calculated_metrics refresh.
 *
 * Usage:
 *   npx ts-node packages/backend/src/scripts/refresh-calculated-metrics.ts
 *   npx ts-node packages/backend/src/scripts/refresh-calculated-metrics.ts --year=2025
 *
 * Runs investment metrics + months_of_supply (all geos), overvalued_pct (all
 * geos), and 5-year growth (all geos). Affordability metrics are produced
 * separately (FRED-dependent) and are NOT included here.
 *
 * Success gate for CI: output line starting with "TOTAL:".
 */

// Load .env.local before NestJS bootstrap so ConfigModule picks up secrets
// at injection time. AppModule's ConfigModule.forRoot lists .env.local in
// envFilePath, but that resolution happens after DI starts — the explicit
// load here ensures vars are available immediately.
import { loadEnvFile } from './backfill-helpers';
loadEnvFile();
// Also load .env.local explicitly (backfill-helpers loads .env only)
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
import { CalculatedMetricsService } from '../metrics/calculated-metrics.service';

async function main() {
  const start = Date.now();
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const svc = app.get(CalculatedMetricsService);
    const yearArg = process.argv.find((a) => a.startsWith('--year='));
    const year = yearArg ? Number(yearArg.split('=')[1]) : undefined;
    const res = await svc.refreshAllCalculatedMetrics(year);
    const stored =
      (res.investment?.stored ?? 0) +
      (res.overvalued?.stored ?? 0) +
      (res.growth?.stored ?? 0);

    // Surface per-section errors without failing on a handful of region-level
    // issues (a monthly run with a few bad regions is still a useful run).
    const errors = [
      ...(res.investment?.errors ?? []),
      ...(res.overvalued?.errors ?? []),
      ...(res.growth?.errors ?? []),
    ];
    if (errors.length > 0) {
      console.warn(
        `[WARN] ${errors.length} error(s) during refresh (first 10):`,
      );
      for (const e of errors.slice(0, 10)) console.warn(`  - ${e}`);
    }

    // A run that stored nothing is a failure, not a success — guard against the
    // CI gate going green on "TOTAL: 0" when every upsert failed.
    if (stored === 0) {
      console.error(
        '[FATAL] calculated metrics refresh stored 0 rows — treating as failure',
      );
      await app.close();
      process.exit(1);
    }

    console.log(
      `TOTAL: ${stored} calculated_metrics rows stored in ${((Date.now() - start) / 1000).toFixed(1)}s`,
    );
    await app.close();
    process.exit(0);
  } catch (err) {
    console.error('[FATAL] calculated metrics refresh failed:', err);
    await app.close();
    process.exit(1);
  }
}

void main();
