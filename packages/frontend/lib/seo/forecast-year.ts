/**
 * Display year for /forecast pages, derived from the latest score period.
 * From October onward searchers look for NEXT year's forecast, so Oct-Dec
 * periods roll the display year forward. Falls back to the current UTC date
 * when no valid period date is available.
 *
 * Kept in sync (3 lines of logic) with the backend twin:
 * packages/backend/src/insights/forecast-display-year.ts
 */
export function forecastDisplayYear(latestDate: string | null): number {
  const parsed = latestDate ? new Date(latestDate) : null;
  const d = parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date();
  const year = d.getUTCFullYear();
  return d.getUTCMonth() >= 9 ? year + 1 : year; // month index 9 = October
}
