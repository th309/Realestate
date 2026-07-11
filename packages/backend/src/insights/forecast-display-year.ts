/**
 * Display year for forecast content, derived from generation time (which
 * tracks the monthly score period). From October onward, searchers look for
 * NEXT year's forecast, so Oct-Dec roll the display year forward.
 *
 * Kept in sync (3 lines of logic) with the frontend twin:
 * packages/frontend/lib/seo/forecast-year.ts
 */
export function forecastDisplayYear(now: Date = new Date()): number {
  const year = now.getUTCFullYear();
  return now.getUTCMonth() >= 9 ? year + 1 : year; // month index 9 = October
}
