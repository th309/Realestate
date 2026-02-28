/**
 * County FIPS code lookup module for Redfin import pipeline.
 *
 * Loads the County-to-State CSV (data/Normalization/County to State.csv)
 * into memory once at startup, then provides O(1) sync lookups by
 * county name + state abbreviation.
 *
 * CSV format: County,State,State Abbreviation,County Population,FIPS - County Code,...
 * Example:    "Autauga County","Alabama","AL",59285,"01001",...
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { parse } from "csv-parse/sync";

interface CountyCsvRow {
  County: string;
  "State Abbreviation": string;
  "FIPS - County Code": string;
}

/** Map keyed by "county name|ST" (lowercased) → 5-digit FIPS code */
let fipsMap: Map<string, string> | null = null;

/** Build the normalized lookup key from county name and state abbreviation */
function buildKey(countyName: string, stateAbbrev: string): string {
  return `${countyName.toLowerCase().trim()}|${stateAbbrev.toLowerCase().trim()}`;
}

/**
 * Load the County-to-State CSV into the in-memory FIPS map.
 * Must be called once before any lookups. Safe to call multiple times
 * (subsequent calls are no-ops).
 */
export function initCountyFipsLookup(): void {
  if (fipsMap) return;

  const csvPath = resolve(
    __dirname,
    "../../data/Normalization/County to State.csv",
  );
  const csvContent = readFileSync(csvPath, "utf-8");
  const rows: CountyCsvRow[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  fipsMap = new Map();

  for (const row of rows) {
    const county = row.County;
    const state = row["State Abbreviation"];
    const fips = row["FIPS - County Code"];

    if (!county || !state || !fips) continue;

    // Key with full county name as-is (e.g., "autauga county|al")
    fipsMap.set(buildKey(county, state), fips);

    // Also key without " County" / " Parish" / " Borough" suffix for fuzzy matching
    // Redfin sometimes includes or omits these suffixes
    const stripped = county
      .replace(/\s+(County|Parish|Borough|Census Area|Municipality|city)$/i, "")
      .trim();
    if (stripped !== county) {
      fipsMap.set(buildKey(stripped, state), fips);
    }
  }

  console.log(
    `  County FIPS lookup loaded: ${rows.length} rows, ${fipsMap.size} keys`,
  );
}

/**
 * Look up a county FIPS code by name and state abbreviation.
 * Returns the 5-digit FIPS code or null if not found.
 *
 * Handles Redfin's county name format which may include a trailing ", ST"
 * state suffix (e.g., "Autauga County, AL") or just the bare county name.
 */
export function lookupCountyFips(
  countyName: string | null | undefined,
  stateCode: string | null | undefined,
): string | null {
  if (!fipsMap) {
    console.warn(
      "  WARNING: County FIPS lookup not initialized. Call initCountyFipsLookup() first.",
    );
    return null;
  }
  if (!countyName || !stateCode) return null;

  // Strip trailing ", ST" state suffix if present (Redfin format: "Autauga County, AL")
  let name = countyName.replace(/,\s*[A-Z]{2}\s*$/, "").trim();

  // Try exact match first
  const exactKey = buildKey(name, stateCode);
  const exactMatch = fipsMap.get(exactKey);
  if (exactMatch) return exactMatch;

  // Try without county/parish/borough suffix
  const stripped = name
    .replace(/\s+(County|Parish|Borough|Census Area|Municipality|city)$/i, "")
    .trim();
  if (stripped !== name) {
    const strippedKey = buildKey(stripped, stateCode);
    const strippedMatch = fipsMap.get(strippedKey);
    if (strippedMatch) return strippedMatch;
  }

  // Try adding " County" suffix (if Redfin uses bare name but CSV has "X County")
  const withCounty = buildKey(`${name} County`, stateCode);
  const withCountyMatch = fipsMap.get(withCounty);
  if (withCountyMatch) return withCountyMatch;

  return null;
}
