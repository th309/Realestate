/**
 * Pure header/region normalization for the Redfin Data Center CSV format.
 * Every dashboard shares the same column-naming convention, so one
 * normalizer serves all of them.
 */

/** Convert a raw Redfin DC header to a snake_case DB column name. */
export function normalizeColumnName(header: string): string {
  return header
    .toLowerCase()
    .replace(/\(\$\)|\(%\)|\(ppts\)|\(days\)/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/** Map a Redfin "REGION TYPE" cell to our internal geo-level string. */
export function normalizeRegionTypeToGeoLevel(regionType: string): string {
  const t = regionType.trim().toLowerCase();
  if (t === "country") return "country";
  if (t === "state") return "state";
  if (t === "metro") return "metro";
  if (t === "county") return "county";
  if (t === "zip") return "zip";
  if (t === "census region") return "census_region";
  return t;
}
