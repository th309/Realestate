/**
 * Frequency-aware incremental cutoff for backend data feed services.
 *
 * Mirror of `scripts/lib/incremental-cutoff.ts` for the NestJS tree (the
 * backend cannot import from `scripts/`). Keep the lookback values in sync
 * between the two files — they encode the same policy.
 *
 * See the scripts/lib version for the rationale behind each lookback value.
 */

export type IngestFrequency = 'monthly' | 'quarterly' | 'annual';

export interface IncrementalCutoffOptions {
  frequency: IngestFrequency;
  fullLoad?: boolean;
  lookbackMonthsOverride?: number;
}

const FREQUENCY_LOOKBACK_MONTHS: Record<IngestFrequency, number> = {
  monthly: 3,
  quarterly: 9,
  annual: 24,
};

/**
 * Compute a YYYY-MM-DD cutoff date `N` months back from today.
 * Mirrors `scripts/lib/parse-helpers.ts::computeDateCutoff`.
 */
function computeDateCutoff(months: number): string {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  return cutoff.toISOString().slice(0, 10);
}

/**
 * Returns a YYYY-MM-DD string cutoff, or null when fullLoad is requested.
 */
export function getIncrementalCutoff(
  options: IncrementalCutoffOptions,
): string | null {
  if (options.fullLoad) return null;

  const months =
    options.lookbackMonthsOverride ??
    FREQUENCY_LOOKBACK_MONTHS[options.frequency];

  if (months <= 0) {
    throw new Error(
      `Invalid lookback for frequency "${options.frequency}": ${months}.`,
    );
  }

  return computeDateCutoff(months);
}
