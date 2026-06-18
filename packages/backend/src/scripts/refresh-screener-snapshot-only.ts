/**
 * Headless CLI: rebuild screener_snapshot AFTER the monthly PropertyIQ rescore.
 *
 * Runs as its own CI job (refresh-screener-after-scoring) that `needs:` the
 * scoring job, so the snapshot — including the score-movers deltas — is built
 * once per month from the freshest scores, not last month's. Fatal on failure:
 * a stale movers table should go red, not warn.
 *
 * Calls refresh_screener_snapshot() over a DIRECT Postgres connection (pg), NOT
 * supabase-js / PostgREST. The refresh rebuilds ~34k rows with six month-end
 * delta self-joins and runs >60s; the PostgREST HTTP gateway caps requests at
 * ~60s and returns "fetch failed" mid-run even though the function (which sets
 * its own statement_timeout = 600s) commits successfully. A direct pg connection
 * respects the function's timeout and returns the real row count when the rebuild
 * finishes — so the job's success/failure reflects the actual DB outcome.
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

import { Client } from 'pg';

async function main() {
  const start = Date.now();

  // CI provides DATABASE_URL; local dev uses SUPABASE_DB_URL. No hardcoded
  // fallback — the job must fail loudly if neither is set (CLAUDE.md §1.2).
  const connectionString =
    process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error(
      '[FATAL] DATABASE_URL (CI) or SUPABASE_DB_URL (local) is required',
    );
    process.exit(1);
  }

  // Bare connectionString (matches the repo's existing pg usage) — SSL is governed
  // by the URL's sslmode (Supabase URLs carry sslmode=require), so no explicit,
  // verification-disabling ssl option is needed here.
  const client = new Client({
    connectionString,
    // Backstop above the function's own 600s SET; the rebuild runs ~60-120s.
    statement_timeout: 660000,
  });

  try {
    await client.connect();
    const res = await client.query<{ rows: number }>(
      'SELECT refresh_screener_snapshot() AS rows',
    );
    const rows = Number(res.rows?.[0]?.rows ?? 0);
    if (!rows) {
      console.error(
        '[FATAL] screener_snapshot refresh stored 0 rows — treating as failure',
      );
      await client.end();
      process.exit(1);
    }
    console.log(
      `TOTAL: ${rows} screener_snapshot rows in ${((Date.now() - start) / 1000).toFixed(1)}s`,
    );
    await client.end();
    process.exit(0);
  } catch (err) {
    console.error('[FATAL] screener_snapshot refresh failed:', err);
    try {
      await client.end();
    } catch {
      // ignore teardown error on an already-broken connection
    }
    process.exit(1);
  }
}

void main();
