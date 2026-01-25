/**
 * Single source of truth for ZIP/postal code used as a map or data key.
 *
 * Map GeoJSON uses 5-digit ZCTA codes (ZCTA5CE20 / GEOID20). APIs and DBs often
 * return postal_code with or without leading zeros. Using this function everywhere
 * that produces or consumes ZIP keys ensures the map layer can match data to shapes
 * without repeated fixes.
 *
 * USE THIS WHEN:
 * - Building a Record keyed by ZIP (e.g. from API responses for map or metrics)
 * - Looking up map data by ZIP (e.g. in useMapLayers for zip level)
 *
 * At import time the same rule is applied: packages/backend/src/common/zip.ts and
 * scripts/utils/zip.ts normalize postal_code when writing to realtor_zip or
 * calculated_metrics, so stored data matches map GeoJSON (ZCTA5CE20).
 *
 * Do not add ad-hoc padStart or replace logic elsewhere—centralize here.
 * New metrics or endpoints that return ZIP-keyed data must use this so the map
 * keeps working without per-metric fixes.
 */
export function normalizeZipKey(code: string): string {
  const s = String(code).trim();
  return s.length <= 5 ? s.padStart(5, '0') : s;
}
