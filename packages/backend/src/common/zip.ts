/**
 * Normalize ZIP/postal code at import and when writing to DB.
 * Same rule as frontend lib/format/zip.ts: 5-digit string so map GeoJSON (ZCTA5CE20) matches.
 *
 * Use when any source ingests or writes zip-level data: Realtor, Census/ACS, Zillow, FRED (if zip added), etc.
 * e.g. realtor_zip.postal_code, census_zip.zcta, zillow_zip.region_name, calculated_metrics.geography_id.
 */
export function normalizeZipKey(code: string): string {
  const s = String(code).trim();
  return s.length <= 5 ? s.padStart(5, '0') : s;
}

/**
 * Calculate Compound Annual Growth Rate (CAGR)
 *
 * CAGR = ((endValue / startValue)^(1/years) - 1) * 100
 *
 * @param startValue - Initial value (value from N years ago)
 * @param endValue - Final value (current value)
 * @param years - Number of years (default 5)
 * @returns CAGR as a percentage rounded to 2 decimal places, or null if invalid
 *
 * @example
 * // Property went from $300K to $405K over 5 years
 * calculateCAGR(300000, 405000, 5) // Returns 6.19 (6.19% annual growth)
 */
export function calculateCAGR(
  startValue: number | null | undefined,
  endValue: number | null | undefined,
  years: number = 5,
): number | null {
  if (
    startValue === null ||
    startValue === undefined ||
    startValue <= 0 ||
    endValue === null ||
    endValue === undefined ||
    endValue <= 0
  ) {
    return null;
  }
  const cagr = (Math.pow(endValue / startValue, 1 / years) - 1) * 100;
  return Math.round(cagr * 100) / 100;
}
