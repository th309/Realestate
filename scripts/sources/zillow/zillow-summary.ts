/**
 * Summary printer and helpers for Zillow import results.
 */

import type { ImportGeographyResult } from "../../lib";

/** Find the most recent period_date value in transposed records. */
export function findLatestDate(
  records: Record<string, unknown>[],
): string | null {
  let latest: string | null = null;
  for (const record of records) {
    const date = record.period_date as string | undefined;
    if (date && (latest === null || date > latest)) latest = date;
  }
  return latest;
}

/** Print a formatted summary table of Zillow import results. */
export function printZillowSummary(
  results: ImportGeographyResult[],
  totalDurationMs: number,
): void {
  const divider = "=".repeat(60);
  console.log(`\n${divider}`);
  console.log("  ZILLOW IMPORT SUMMARY");
  console.log(divider);

  let totalInserted = 0;
  let totalFailed = 0;

  for (const geo of results) {
    const label =
      geo.status === "success"
        ? "OK"
        : geo.status === "partial"
          ? "PARTIAL"
          : geo.status === "skipped"
            ? "SKIP"
            : "FAIL";
    const dur = (geo.durationMs / 1000).toFixed(1);
    console.log(
      `  [${label.padEnd(7)}] ${geo.geographyId.padEnd(28)} ${geo.recordsInserted.toLocaleString().padStart(10)} ins, ${geo.recordsFailed.toLocaleString().padStart(6)} fail (${dur}s)`,
    );
    if (geo.latestPeriodDate)
      console.log(`             Latest: ${geo.latestPeriodDate}`);
    if (geo.errors.length > 0)
      geo.errors
        .slice(0, 2)
        .forEach((e) => console.log(`             Error: ${e}`));
    totalInserted += geo.recordsInserted;
    totalFailed += geo.recordsFailed;
  }

  const allOk = results.every(
    (r) => r.status === "success" || r.status === "skipped",
  );
  const status = allOk
    ? "SUCCESS"
    : results.some((r) => r.status === "success")
      ? "PARTIAL"
      : "FAILED";

  console.log(divider);
  console.log(
    `  Datasets: ${results.length} | Inserted: ${totalInserted.toLocaleString()} | Failed: ${totalFailed.toLocaleString()}`,
  );
  console.log(
    `  Status: ${status} | Duration: ${(totalDurationMs / 1000).toFixed(1)}s`,
  );
  console.log(divider);
}
