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
