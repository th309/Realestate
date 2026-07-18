/**
 * Independent cities are Census county-equivalents legally separate from any
 * county — mostly Virginia (every VA city is independent), plus Baltimore
 * City MD, St. Louis City MO, and Carson City NV. A county-slug generator
 * that doesn't detect these will either collide with a same-named real
 * county's slug (shadowing one in a last-write-wins map, e.g. Richmond
 * city/county both -> "richmond-county-va") or render under an invented
 * name that doesn't exist (e.g. "Virginia Beach County").
 *
 * Verified against zillow_county.fips_code (2026-07-18): every VA
 * independent city has a county-part FIPS >= 510, while every real VA
 * county is <= 199 — a stable US Census FIPS convention, not specific to
 * this dataset. Detection is FIPS-based (not name-based) specifically so it
 * doesn't misfire on real counties whose proper name contains "City" —
 * James City County (FIPS 51095) and Charles City County (FIPS 51036).
 */
const NON_VA_INDEPENDENT_CITY_FIPS = new Set(["24510", "29510", "32510"]);

export function isIndependentCity(fips: string): boolean {
  if (NON_VA_INDEPENDENT_CITY_FIPS.has(fips)) return true;
  return fips.startsWith("51") && Number(fips.slice(2)) >= 510;
}
