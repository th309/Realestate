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

/** Title-case a (possibly multi-word) place name. */
function titleCase(raw: string): string {
  return raw
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Parse the `/api/markets/zips` row into {city, state}.
 *
 * The endpoint's `name` is `row.zip_name || row.postal_code` — when the upstream
 * `realtor_zip.zip_name` is NULL (≈553 ZIPs) the `name` is just the bare ZIP with
 * no `", ST"` suffix. Detecting "no comma" alone is insufficient because that
 * case also produces `cityName === zip` (e.g. "01093"), which previously yielded
 * the malformed `01093-01093` slug. We mark such rows as missing a city so the
 * caller can backfill from geography_crosswalk; if even that has no city, the row
 * is skipped rather than emitting a broken page.
 */
function parseZipRow(row: ZipApiRow): ParsedZip & { hasCity: boolean } {
  // name format: "city name, st" (always a trailing ", XX" state abbrev)
  const commaIdx = row.name.lastIndexOf(",");
  const cityRaw =
    commaIdx >= 0 ? row.name.slice(0, commaIdx).trim() : row.name.trim();
  const stateRaw = commaIdx >= 0 ? row.name.slice(commaIdx + 1).trim() : "";

  // A real city is present only when we parsed a non-empty city that isn't just
  // the ZIP echoed back AND a 2-letter state abbreviation.
  const hasCity =
    cityRaw.length > 0 && cityRaw !== row.code && stateRaw.length > 0;

  return {
    zip: row.code,
    cityName: titleCase(cityRaw),
    state: stateRaw.toUpperCase(),
    hasCity,
  };
}

/** Crosswalk-derived per-ZIP enrichment used both for parent links and as the
 *  authoritative city/state fallback when the /api/markets/zips `name` lacks a
 *  city (geography_crosswalk has zip_default_city/state for every tracked ZIP). */
interface CrosswalkEntry {
  countyFips: string | null;
  cbsaCode: string | null;
  defaultCity: string | null;
  defaultState: string | null;
}

async function fetchCrosswalkMaps(): Promise<Map<string, CrosswalkEntry>> {
  const crosswalk = new Map<string, CrosswalkEntry>();

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — countyFips, cbsaCode, and city fallback will be unavailable.",
    );
    return crosswalk;
  }

  console.log(
    "Fetching ZIP crosswalk data (county_fips + cbsa_code + default city/state)...",
  );
  // Paginate with Range headers to bypass Supabase's max-rows cap regardless of project setting.
  const PAGE_SIZE = 1000;
  let offset = 0;
  let totalRawRows = 0;
  let fetchError = false;

  while (true) {
    const pageRes = await fetch(
      `${SUPABASE_URL}/rest/v1/geography_crosswalk?select=zip_code,county_fips,cbsa_code,zip_default_city,zip_default_state`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          Range: `${offset}-${offset + PAGE_SIZE - 1}`,
          "Range-Unit": "items",
        },
      },
    );
    if (!pageRes.ok) {
      console.warn(
        `Could not fetch ZIP crosswalk page at offset ${offset} (${pageRes.status}) — countyFips, cbsaCode, and city fallback may be unavailable.`,
      );
      fetchError = true;
      break;
    }
    const page: {
      zip_code: string;
      county_fips: string | null;
      cbsa_code: string | null;
      zip_default_city: string | null;
      zip_default_state: string | null;
    }[] = await pageRes.json();
    totalRawRows += page.length;
    for (const row of page) {
      if (row.zip_code) {
        crosswalk.set(row.zip_code, {
          countyFips: row.county_fips ?? null,
          cbsaCode: row.cbsa_code ?? null,
          defaultCity: row.zip_default_city?.trim() || null,
          defaultState: row.zip_default_state?.trim() || null,
        });
      }
    }
    if (page.length < PAGE_SIZE) break; // last page
    offset += PAGE_SIZE;
  }

  if (!fetchError) {
    console.log(`Crosswalk raw row count: ${totalRawRows}`);
    console.log(`Loaded ${crosswalk.size} crosswalk entries.`);
  }
  return crosswalk;
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

  // Enrichment from geography_crosswalk: county/cbsa parents AND the
  // authoritative city/state fallback when the API `name` lacks a city.
  const crosswalk = await fetchCrosswalkMaps();

  let backfilledCity = 0;
  let skippedNoCity = 0;

  const entries = apiRows
    .filter((row) => publishedZips.has(row.code))
    .map((row) => {
      const parsed = parseZipRow(row);
      const cw = crosswalk.get(parsed.zip);

      // Resolve city/state, backfilling from geography_crosswalk when the API
      // row had no city (the ≈553 "01093-01093" malformed cases).
      let { cityName, state } = parsed;
      if (!parsed.hasCity) {
        if (cw?.defaultCity && cw?.defaultState) {
          cityName = titleCase(cw.defaultCity);
          state = cw.defaultState.toUpperCase();
          backfilledCity++;
        } else {
          // No city anywhere — exclude rather than emit a broken "<zip>-<zip>"
          // page (skipped from both static params AND the sitemap, which read
          // this same JSON).
          skippedNoCity++;
          return null;
        }
      }

      return {
        zip: parsed.zip,
        slug: generateZipSlug(parsed.zip, cityName, state),
        name: `${parsed.zip} (${cityName})`,
        shortName: `${parsed.zip}, ${cityName}, ${state}`,
        state,
        countyFips: cw?.countyFips ?? null,
        cbsaCode: cw?.cbsaCode ?? null,
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);

  console.log(
    `Published ZIPs: ${entries.length} / ${apiRows.length} tracked (window: ${publish.join(", ")})`,
  );
  console.log(
    `City backfilled from crosswalk: ${backfilledCity}; excluded (no city anywhere): ${skippedNoCity}`,
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
