/**
 * Pipeline status reporting + overall-status determination.
 *
 * Replaces the identical `reportPipelineStatus` function previously
 * duplicated in zillow/fred/census services, plus the status/error-summary
 * boilerplate that lived at the end of each service's import method.
 *
 * Behavior is preserved exactly — same endpoint, same payload shape,
 * same fire-and-forget semantics.
 */

const PIPELINE_API_URL =
  process.env.INTERNAL_API_URL || 'http://localhost:3001';

export type PipelineStatus = 'success' | 'partial' | 'failed';
export type GeographyStatus = PipelineStatus | 'skipped';

export interface PipelineGeographyReport {
  id: string;
  table: string;
  status: GeographyStatus;
  inserted: number;
  failed: number;
}

/**
 * POST a pipeline-status report to the internal health endpoint.
 * Fire-and-forget: never throws, never blocks the import on a reporting
 * failure, and silently no-ops when PIPELINE_API_KEY is unset.
 */
export async function reportPipelineStatus(
  source: string,
  status: PipelineStatus,
  totalInserted: number,
  totalFailed: number,
  durationMs: number,
  geographies: PipelineGeographyReport[],
): Promise<void> {
  const apiKey = process.env.PIPELINE_API_KEY;
  if (!apiKey) return;
  try {
    await fetch(`${PIPELINE_API_URL}/api/health/pipeline-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        source,
        status,
        totalInserted,
        totalFailed,
        durationMs,
        geographies,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {
    /* fire-and-forget: never block import on reporting failure */
  }
}

/**
 * Derive the overall status from error/validation/insertion counts.
 * - success: zero of either category of error
 * - partial: some errors but at least one record landed
 * - failed:  nothing landed
 */
export function determineOverallStatus(
  errors: number,
  validationErrors: number,
  inserted: number,
): PipelineStatus {
  if (errors === 0 && validationErrors === 0) return 'success';
  if (inserted > 0) return 'partial';
  return 'failed';
}

/**
 * Build a human-readable error summary, with a high-validation-error-rate
 * annotation when more than 5% of attempted records failed validation.
 * Returns `null` when there's nothing to report.
 */
export function buildErrorSummary(
  errors: number,
  validationErrors: number,
  inserted: number,
): string | null {
  const attempted = inserted + validationErrors;
  const rate = attempted > 0 ? validationErrors / attempted : 0;
  const highValidationRate = rate > 0.05;

  const parts = [
    errors > 0 ? `${errors} DB errors` : null,
    highValidationRate
      ? `${validationErrors} validation errors (${(rate * 100).toFixed(1)}% of records out of range)`
      : validationErrors > 0
        ? `${validationErrors} validation errors`
        : null,
  ].filter(Boolean) as string[];

  return parts.length > 0 ? parts.join('; ') : null;
}
