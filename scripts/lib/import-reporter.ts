/**
 * Import result reporting utilities.
 *
 * Handles printing summary banners to the console and
 * POSTing pipeline status to the backend health endpoint.
 */

import type { ImportSourceResult } from './types';
import { getBackendApiUrl } from './db-client';

/**
 * Print a summary banner to the console after all geographies are imported.
 */
export function printSummaryBanner(result: ImportSourceResult): void {
  const divider = '='.repeat(60);
  console.log(`\n${divider}`);
  console.log(`  IMPORT SUMMARY: ${result.source.toUpperCase()}`);
  console.log(divider);

  for (const geo of result.geographies) {
    const statusLabel =
      geo.status === 'success' ? 'OK' :
      geo.status === 'partial' ? 'PARTIAL' :
      geo.status === 'skipped' ? 'SKIP' : 'FAIL';
    const duration = (geo.durationMs / 1000).toFixed(1);
    console.log(`  [${statusLabel}] ${geo.geographyId.padEnd(12)} ${geo.tableName.padEnd(20)} ${geo.recordsInserted} inserted, ${geo.recordsFailed} failed (${duration}s)`);
    if (geo.latestPeriodDate) {
      console.log(`       Latest date: ${geo.latestPeriodDate}`);
    }
    if (geo.errors.length > 0) {
      geo.errors.slice(0, 3).forEach(e => console.log(`       Error: ${e}`));
    }
  }

  console.log(divider);
  console.log(`  Total: ${result.totalInserted} inserted, ${result.totalFailed} failed`);
  console.log(`  Status: ${result.overallStatus.toUpperCase()}`);
  console.log(`  Duration: ${(result.totalDurationMs / 1000).toFixed(1)}s`);
  console.log(`${divider}\n`);
}

/**
 * POST pipeline status to the backend health endpoint.
 * Non-fatal: warns on failure but does not throw.
 */
export async function reportStatusToBackend(result: ImportSourceResult): Promise<void> {
  const backendUrl = getBackendApiUrl();
  const apiKey = process.env.PIPELINE_API_KEY;

  if (!backendUrl) {
    console.log('  Backend API URL not configured, skipping status report.');
    return;
  }

  if (!apiKey) {
    console.warn('  PIPELINE_API_KEY not set, skipping backend status report.');
    return;
  }

  try {
    const payload = {
      source: result.source,
      status: result.overallStatus,
      totalInserted: result.totalInserted,
      totalFailed: result.totalFailed,
      durationMs: result.totalDurationMs,
      geographies: result.geographies.map(g => ({
        id: g.geographyId,
        table: g.tableName,
        status: g.status,
        inserted: g.recordsInserted,
        failed: g.recordsFailed,
        latestDate: g.latestPeriodDate,
      })),
      timestamp: new Date().toISOString(),
    };

    const response = await fetch(`${backendUrl}/api/health/pipeline-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.warn(`  Backend status report returned ${response.status}: ${response.statusText}`);
    } else {
      console.log('  Pipeline status reported to backend.');
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`  Could not report status to backend: ${message}`);
  }
}
