/**
 * Frequency-aware incremental cutoff for data feed importers.
 *
 * Computes a YYYY-MM-DD lower bound so that importers re-fetch ONLY the most
 * recent periods of a source rather than re-uploading multi-year history every
 * run. Wraps the existing `computeDateCutoff(months)` with a policy table that
 * varies by publish frequency (monthly / quarterly / annual).
 *
 * Why a lookback OVERLAP rather than "strictly after max(period_date)":
 *   Upstream sources (Zillow ZHVI, Redfin, Realtor) routinely REVISE the last
 *   few periods when fresh data arrives. A pure "after max date" filter
 *   silently misses those revisions. The overlap window catches them; the
 *   upsert dedupes unchanged rows for free.
 *
 * Usage:
 *   const cutoff = getIncrementalCutoff({ frequency: "monthly" });
 *   if (cutoff) records = records.filter(r => r.period_date >= cutoff);
 *
 * Pass `fullLoad: true` to disable filtering (for one-off backfills).
 */

import { computeDateCutoff } from "./parse-helpers";

export type IngestFrequency = "monthly" | "quarterly" | "annual";

export interface IncrementalCutoffOptions {
  /** How often the upstream source publishes new data. */
  frequency: IngestFrequency;
  /** When true, returns null so the caller imports the full dataset. */
  fullLoad?: boolean;
  /** Override the default lookback (in months) for this run. */
  lookbackMonthsOverride?: number;
}

/**
 * Lookback windows per publish frequency (in months).
 *  - monthly:   covers ~1 quarter — catches Zillow/Redfin/Realtor revisions
 *               which typically touch the trailing 1-2 months.
 *  - quarterly: covers ~3 quarters — BLS QCEW publishes ~2 quarters in
 *               arrears, so the freshly-available data is already stale.
 *  - annual:    covers 2 vintages — ACS revises the prior year when each
 *               new December release drops.
 */
const FREQUENCY_LOOKBACK_MONTHS: Record<IngestFrequency, number> = {
  monthly: 3,
  quarterly: 9,
  annual: 24,
};

/**
 * Compute the incremental cutoff for an importer run.
 * Returns a YYYY-MM-DD string, or null when fullLoad is requested.
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
      `Invalid lookback for frequency "${options.frequency}": ${months}. ` +
        `Set FREQUENCY_LOOKBACK_MONTHS in scripts/lib/incremental-cutoff.ts.`,
    );
  }

  return computeDateCutoff(months);
}

/**
 * Parse `--full` and `--recent=N` flags from process.argv into options.
 * Convenience for CLI importers.
 */
export function parseIncrementalFlagsFromArgv(
  argv: string[] = process.argv,
): Pick<IncrementalCutoffOptions, "fullLoad" | "lookbackMonthsOverride"> {
  const fullLoad = argv.includes("--full");
  const recentArg = argv.find((a) => a.startsWith("--recent="));
  const lookbackMonthsOverride = recentArg
    ? parseInt(recentArg.split("=")[1], 10)
    : undefined;
  return { fullLoad, lookbackMonthsOverride };
}
