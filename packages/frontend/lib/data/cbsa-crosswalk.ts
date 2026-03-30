/**
 * CBSA Code Crosswalk
 *
 * ~13 metros changed CBSA codes in the 2023 Census delineation update.
 * TIGER shapefiles and our DB may use either old or new codes depending
 * on migration/cache state. This module provides bidirectional lookup
 * so data joins succeed regardless of which side has old vs new codes.
 */

import type { GeoLevel, SnapshotEntry } from "./types";

/** Old (pre-2023) → New (2023 delineation) CBSA codes */
const OLD_TO_NEW: Record<string, string> = {
  "14454": "14460", // Boston
  "16984": "16980", // Chicago
  "17460": "17410", // Cleveland
  "19124": "19100", // Dallas
  "19804": "19820", // Detroit
  "30100": "30150", // Lebanon NH
  "31084": "31080", // Los Angeles
  "33124": "33100", // Miami
  "35614": "35620", // New York
  "37964": "37980", // Philadelphia
  "41884": "41860", // San Francisco
  "42644": "42660", // Seattle
  "47894": "47900", // Washington DC
};

/** New (2023 delineation) → Old (pre-2023) CBSA codes */
const NEW_TO_OLD: Record<string, string> = Object.fromEntries(
  Object.entries(OLD_TO_NEW).map(([k, v]) => [v, k]),
);

/**
 * Look up a region entry in snapshot data, trying the given key first,
 * then old→new and new→old CBSA fallbacks for metro-level data.
 */
export function lookupWithCbsaFallback(
  data: Record<string, number | SnapshotEntry>,
  regionId: string,
  geoLevel: GeoLevel,
): SnapshotEntry | number | null {
  // Direct match — fast path
  const direct = data[regionId];
  if (direct !== undefined) return direct;

  // Only apply CBSA fallback for metro level
  if (geoLevel !== "metro") return null;

  // Try old→new mapping (regionId is old code, data has new code)
  const newCode = OLD_TO_NEW[regionId];
  if (newCode && data[newCode] !== undefined) return data[newCode];

  // Try new→old mapping (regionId is new code, data has old code)
  const oldCode = NEW_TO_OLD[regionId];
  if (oldCode && data[oldCode] !== undefined) return data[oldCode];

  return null;
}

export {
  OLD_TO_NEW as TIGER_TO_SYSTEM_CBSA,
  NEW_TO_OLD as SYSTEM_TO_TIGER_CBSA,
};
