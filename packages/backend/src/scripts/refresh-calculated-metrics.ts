/**
 * Headless CLI: run the monthly calculated_metrics refresh.
 *
 * Usage:
 *   npx ts-node packages/backend/src/scripts/refresh-calculated-metrics.ts
 *   npx ts-node packages/backend/src/scripts/refresh-calculated-metrics.ts --year=2025
 *
 * Runs investment metrics + months_of_supply (all geos), overvalued_pct (all
 * geos), 5-year growth (all geos), and affordability (income_to_buy /
 * affordable_home_price / years_to_save, all geos — mortgage rate from FRED).
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

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MetricsModule } from '../metrics/metrics.module';
import { CalculatedMetricsService } from '../metrics/calculated-metrics.service';
/**
 * Minimal context for the metrics CLI. MetricsModule imports only SupabaseModule,
 * so this boots with just the DB credentials and avoids AppModule's unrelated
 * env-hard-requirements (PLATFORM_CREDENTIALS_ENCRYPTION_KEY, OPENAI_API_KEY, ...)
 * that crash the full-app bootstrap in CI.
 *
 * NOTE: ScreenerModule removed — screener_snapshot is now refreshed AFTER scoring
 * by refresh-screener-snapshot-only.ts (CI job: refresh-screener-after-scoring).
 */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), MetricsModule],
})
class MetricsCliModule {}

async function main() {
  const start = Date.now();
  const app = await NestFactory.createApplicationContext(MetricsCliModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const svc = app.get(CalculatedMetricsService);
    const yearArg = process.argv.find((a) => a.startsWith('--year='));
    const year = yearArg ? Number(yearArg.split('=')[1]) : undefined;
    const res = await svc.refreshAllCalculatedMetrics(year);
    const aff = res.affordability;
    const affStored =
      (aff?.incomeToBuy?.stored ?? 0) +
      (aff?.affordableHomePrice?.stored ?? 0) +
      (aff?.yearsToSave?.stored ?? 0);
    const stored =
      (res.investment?.stored ?? 0) +
      (res.overvalued?.stored ?? 0) +
      (res.growth?.stored ?? 0) +
      affStored;

    // Surface per-section errors without failing on a handful of region-level
    // issues (a monthly run with a few bad regions is still a useful run).
    const errors = [
      ...(res.investment?.errors ?? []),
      ...(res.overvalued?.errors ?? []),
      ...(res.growth?.errors ?? []),
      ...(aff?.incomeToBuy?.errors ?? []),
      ...(aff?.affordableHomePrice?.errors ?? []),
      ...(aff?.yearsToSave?.errors ?? []),
    ];
    if (errors.length > 0) {
      const uniqueErrors = [...new Set(errors)];
      console.warn(
        `[WARN] ${errors.length} error(s) during refresh (${uniqueErrors.length} unique):`,
      );
      for (const e of uniqueErrors.slice(0, 40)) console.warn(`  - ${e}`);
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

    // NOTE: screener_snapshot is NOT refreshed here. It now refreshes AFTER the
    // scoring job (refresh-screener-snapshot-only.ts) so the movers deltas and the
    // displayed score reflect the freshest rescore, not last month's.
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
