/**
 * Normalize ZIP/postal code when importing ZIP data (scripts).
 * Keep in sync with packages/backend/src/common/zip.ts and packages/frontend/lib/format/zip.ts.
 * Use when any source writes zip-level data: Realtor, Census/ACS, Zillow, FRED (if zip added), etc.
 * Ensures stored keys match map GeoJSON (ZCTA5CE20) and calculated_metrics.geography_id for zip.
 */
export function normalizeZipKey(code: string): string {
  const s = String(code).trim();
  return s.length <= 5 ? s.padStart(5, '0') : s;
}
