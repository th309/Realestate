// Run with: API_URL=<backend> npx tsx scripts/generate-zip-slugs.ts
//
// Fetches all ZIPs from the backend API (/api/markets/zips) and generates
// packages/frontend/lib/data/zip-slug-data.json with score-gated entries.
// The TypeScript wrapper (zip-slug-data.ts) imports this JSON and exports typed maps.
//
// Score-gate: only ZIPs that appear in the published scoring window are written.
// Fail-closed: throws before any file write if the published set is empty.
//
// Live endpoint payload shape (confirmed 2026-06-25):
//   { code: string, name: string }  -- name is lowercase "city, state" e.g. "beverly hills, ca"
// No county_fips or cbsa_code on this endpoint; those are enriched via geography_crosswalk
// if SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set, otherwise null.

import { generateZipSlug } from "../packages/frontend/lib/data/zip-slugs";
import {
  pickWindows,
  computePublishedIds,
  assertNonEmpty,
} from "./lib/published-set";
import { fetchScoredByPeriod } from "./lib/scored-set-client";

const API_BASE = process.env.API_URL || "http://localhost:3001";

// Optional: enrich with CBSA and county FIPS via geography_crosswalk
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Shape returned by /api/markets/zips */
interface ZipApiRow {
  code: string; // 5-digit ZIP, e.g. "90210"
  name: string; // lowercase "city, state", e.g. "beverly hills, ca"
}

/** Parsed fields derived from the API row */
interface ParsedZip {
  zip: string;
  cityName: string; // title-cased, e.g. "Beverly Hills"
  state: string; // upper-cased 2-letter abbrev, e.g. "CA"
}

function parseZipRow(row: ZipApiRow): ParsedZip {
  // name format: "city name, st" (always a trailing ", XX" state abbrev)
  const commaIdx = row.name.lastIndexOf(",");
  const cityRaw =
    commaIdx >= 0 ? row.name.slice(0, commaIdx).trim() : row.name.trim();
  const stateRaw = commaIdx >= 0 ? row.name.slice(commaIdx + 1).trim() : "";

  // Title-case the city (handles multi-word names)
  const cityName = cityRaw
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return {
    zip: row.code,
    cityName,
    state: stateRaw.toUpperCase(),
  };
}

async function fetchCrosswalkMaps(): Promise<{
  zipToCountyFips: Map<string, string | null>;
  zipToCbsaCode: Map<string, string | null>;
}> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — countyFips and cbsaCode will be null.",
    );
    return {
      zipToCountyFips: new Map(),
      zipToCbsaCode: new Map(),
    };
  }

  console.log("Fetching ZIP crosswalk data (county_fips + cbsa_code)...");
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/geography_crosswalk?select=zip_code,county_fips,cbsa_code`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    },
  );

  if (!res.ok) {
    console.warn(
      `Could not fetch ZIP crosswalk (${res.status}) — countyFips and cbsaCode will be null.`,
    );
    return { zipToCountyFips: new Map(), zipToCbsaCode: new Map() };
  }

  const rows: {
    zip_code: string;
    county_fips: string | null;
    cbsa_code: string | null;
  }[] = await res.json();

  const zipToCountyFips = new Map<string, string | null>();
  const zipToCbsaCode = new Map<string, string | null>();
  for (const row of rows) {
    if (row.zip_code) {
      zipToCountyFips.set(row.zip_code, row.county_fips ?? null);
      zipToCbsaCode.set(row.zip_code, row.cbsa_code ?? null);
    }
  }
  console.log(`Loaded ${rows.length} crosswalk entries.`);
  return { zipToCountyFips, zipToCbsaCode };
}

async function main() {
  const endpoint = `${API_BASE}/api/markets/zips`;
  console.log(`Fetching ZIPs from ${endpoint}...`);

  const res = await fetch(endpoint);
  if (!res.ok) {
    throw new Error(`API returned ${res.status}: ${await res.text()}`);
  }

  const apiRows: ZipApiRow[] = await res.json();
  console.log(`Fetched ${apiRows.length} ZIPs.`);

  // Fetch the published scoring window and compute the set of ZIP codes to emit.
  const { periods, scoredByPeriod } = await fetchScoredByPeriod(
    API_BASE,
    "zip",
  );
  const { publish } = pickWindows(periods);
  const publishedZips = computePublishedIds(scoredByPeriod, publish);
  assertNonEmpty("zip", publishedZips); // fail-closed before any write

  // Optional enrichment from geography_crosswalk
  const { zipToCountyFips, zipToCbsaCode } = await fetchCrosswalkMaps();

  const entries = apiRows
    .filter((row) => publishedZips.has(row.code))
    .map((row) => {
      const { zip, cityName, state } = parseZipRow(row);
      return {
        zip,
        slug: generateZipSlug(zip, cityName, state),
        name: `${zip} (${cityName})`,
        shortName: `${zip}, ${cityName}, ${state}`,
        state,
        countyFips: zipToCountyFips.get(zip) ?? null,
        cbsaCode: zipToCbsaCode.get(zip) ?? null,
      };
    });

  console.log(
    `Published ZIPs: ${entries.length} / ${apiRows.length} tracked (window: ${publish.join(", ")})`,
  );

  if (entries.length === 0) {
    throw new Error(
      "fail-closed: 0 published ZIP entries after filtering — not overwriting JSON",
    );
  }

  // Check for duplicate slugs
  const slugMap = new Map<string, string>();
  let duplicateCount = 0;
  for (const entry of entries) {
    if (slugMap.has(entry.slug)) {
      console.warn(
        `WARNING: Duplicate slug "${entry.slug}" -- ${entry.shortName} vs ${slugMap.get(entry.slug)}`,
      );
      duplicateCount++;
    }
    slugMap.set(entry.slug, entry.shortName);
  }

  if (duplicateCount > 0) {
    console.warn(
      `\nFound ${duplicateCount} duplicate slug(s). Review for conflicts.`,
    );
  }

  const fs = await import("fs");
  const path = await import("path");
  const jsonPath = path.join(
    "packages",
    "frontend",
    "lib",
    "data",
    "zip-slug-data.json",
  );
  fs.writeFileSync(jsonPath, JSON.stringify(entries, null, 2) + "\n");
  console.log(`\nWritten to ${jsonPath}`);
  console.log(`Total entries: ${entries.length}`);
  console.log(`Unique slugs: ${slugMap.size}`);
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
