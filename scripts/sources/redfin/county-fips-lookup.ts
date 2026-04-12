/**
 * County FIPS code lookup for Redfin import pipeline.
 *
 * Loads data/Normalization/County to State.csv into memory once,
 * then provides O(1) sync lookups by county name + state abbreviation.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { parse } from "csv-parse/sync";

let fipsMap: Map<string, string> | null = null;

export function initCountyFipsLookup(): void {
  if (fipsMap) return;
  fipsMap = new Map();

  const csvPath = resolve(
    __dirname,
    "../../../data/Normalization/County to State.csv",
  );
  const rows = parse(readFileSync(csvPath, "utf-8"), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Array<{
    County: string;
    "State Abbreviation": string;
    "FIPS - County Code": string;
  }>;

  for (const row of rows) {
    const county = row.County;
    const state = row["State Abbreviation"];
    const fips = row["FIPS - County Code"];
    if (!county || !state || !fips) continue;
    fipsMap.set(`${county.toLowerCase()}|${state.toLowerCase()}`, fips);
  }
  console.log(`  County FIPS lookup loaded: ${fipsMap.size} entries`);
}

export function lookupCountyFips(
  county: string | null,
  state: string | null,
): string | null {
  if (!county || !state || !fipsMap) return null;
  // Redfin county names include state suffix ("Ada County, ID") — strip it
  const cleanName = county.replace(/,\s*[A-Z]{2}$/, "");
  return (
    fipsMap.get(`${cleanName.toLowerCase()}|${state.toLowerCase()}`) || null
  );
}
