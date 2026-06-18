/**
 * Headless CLI: rebuild screener_snapshot AFTER the monthly PropertyIQ rescore.
 *
 * Runs as its own CI job (refresh-screener-after-scoring) that `needs:` the
 * scoring job, so the snapshot — including the score-movers deltas — is built
 * once per month from the freshest scores, not last month's. Fatal on failure:
 * a stale movers table should go red, not warn.
 *
 * Boots a SLIM module (Supabase only) like refresh-piq-scores.ts, avoiding
 * AppModule's email/Stripe/AI DI that the snapshot path never uses.
 *
 * Success gate for CI: output line starting with "TOTAL:". [FATAL] marks failure.
 */
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
import { ScreenerService } from '../screener/screener.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), SupabaseModule],
  providers: [ScreenerService],
})
class ScreenerRefreshCliModule {}

async function main() {
  const start = Date.now();
  const app = await NestFactory.createApplicationContext(
    ScreenerRefreshCliModule,
    { logger: ['error', 'warn', 'log'] },
  );
  try {
    const rows = await app.get(ScreenerService).refreshScreenerSnapshot();
    if (rows === 0) {
      console.error(
        '[FATAL] screener_snapshot refresh stored 0 rows — treating as failure',
      );
      await app.close();
      process.exit(1);
    }
    console.log(
      `TOTAL: ${rows} screener_snapshot rows in ${((Date.now() - start) / 1000).toFixed(1)}s`,
    );
    await app.close();
    process.exit(0);
  } catch (err) {
    console.error('[FATAL] screener_snapshot refresh failed:', err);
    await app.close();
    process.exit(1);
  }
}

void main();
