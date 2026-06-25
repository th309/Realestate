// scripts/generate-descored-redirects.ts
// Generates a redirect map for de-scored geo pages → their nearest published ancestor.
// Run monthly AFTER the slug generators have regenerated the gated JSONs.
// Usage: npx tsx scripts/generate-descored-redirects.ts

import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

import {
  pickWindows,
  resolveAncestorRedirect,
  type AncestorKeys,
} from "./lib/published-set";
import { fetchScoredByPeriod } from "./lib/scored-set-client";
import { STATE_SLUG_DATA } from "../packages/frontend/lib/data/state-slug-data";

const API_BASE = process.env.API_URL ?? "http://localhost:3001";

// ---------------------------------------------------------------------------
// Entry type definitions matching each gated JSON's shape
// ---------------------------------------------------------------------------

interface MetroEntry {
  cbsaCode: string;
  slug: string;
  name: string;
  shortName: string;
  state: string;
}

interface CountyEntry {
  fips: string;
  slug: string;
  name: string;
  shortName: string;
  state: string;
  cbsaCode: string | null;
}

interface ZipEntry {
  zip: string;
  slug: string;
  name: string;
  shortName: string;
  state: string;
  countyFips: string | null;
  cbsaCode: string | null;
}

// ---------------------------------------------------------------------------
// Output type matching Next.js redirects config shape
// ---------------------------------------------------------------------------

interface Redirect {
  source: string;
  destination: string;
  permanent: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DATA_DIR = path.join(__dirname, "../packages/frontend/lib/data");

function readCurrentJson<T>(filename: string): T[] {
  const fullPath = path.join(DATA_DIR, filename);
  return JSON.parse(fs.readFileSync(fullPath, "utf-8")) as T[];
}

/**
 * Read the committed (HEAD) version of a slug JSON via `git show`.
 * Returns [] if the file didn't exist at HEAD (first ever run).
 */
function readHeadJson<T>(relPath: string): T[] {
  // spawnSync with argument array — no shell, no injection surface.
  // maxBuffer MUST exceed the largest slug JSON (zip is ~8MB): the 1MB default
  // silently overflows (ENOBUFS) on `git show`, which would return a false-empty
  // old set and drop every ZIP redirect. 256MB is ample headroom.
  const result = spawnSync("git", ["show", `HEAD:${relPath}`], {
    encoding: "utf-8",
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.error) {
    // A real spawn failure (buffer overflow, git missing, …) must FAIL LOUD —
    // never be masked as "file absent" (that would silently drop redirects).
    throw result.error;
  }
  if (result.status !== 0) {
    // File absent at HEAD (first-ever run): git exits non-zero with a
    // "does not exist in HEAD" stderr and no spawn error. Treat as empty.
    return [];
  }
  return JSON.parse(result.stdout) as T[];
}

/** Build a code → slug map from STATE_SLUG_DATA (abbrev field). */
function buildStateSlugMap(): Map<string, string> {
  return new Map(STATE_SLUG_DATA.map((e) => [e.abbrev, e.slug]));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // Build ancestor lookup maps from the NEW (working-tree) gated JSONs.
  const newMetros = readCurrentJson<MetroEntry>("metro-slug-data.json");
  const newCounties = readCurrentJson<CountyEntry>("county-slug-data.json");

  const publishedMetroSlugByCbsa = new Map(
    newMetros.map((m) => [m.cbsaCode, m.slug]),
  );
  const publishedCountySlugByFips = new Map(
    newCounties.map((c) => [c.fips, c.slug]),
  );

  const stateCodeToSlug = buildStateSlugMap();
  const stateSlugOf = (code: string): string =>
    stateCodeToSlug.get(code) ?? code.toLowerCase();

  const allRedirects: Redirect[] = [];

  // -------------------------------------------------------------------------
  // Metro
  // -------------------------------------------------------------------------
  {
    const { periods, scoredByPeriod } = await fetchScoredByPeriod(
      API_BASE,
      "metro",
    );
    const { lookback } = pickWindows(periods);
    const scoredRecently = new Set<string>();
    for (const p of lookback) {
      for (const id of scoredByPeriod.get(p) ?? []) scoredRecently.add(id);
    }

    const newIds = new Set(newMetros.map((m) => m.cbsaCode));
    const oldMetros = readHeadJson<MetroEntry>(
      "packages/frontend/lib/data/metro-slug-data.json",
    );

    let count = 0;
    for (const oldEntry of oldMetros) {
      if (newIds.has(oldEntry.cbsaCode)) continue;
      if (!scoredRecently.has(oldEntry.cbsaCode)) continue;

      const ancestorKeys: AncestorKeys = { state: oldEntry.state };
      const destination = resolveAncestorRedirect(
        ancestorKeys,
        publishedCountySlugByFips,
        publishedMetroSlugByCbsa,
        stateSlugOf,
      );
      if (destination !== null) {
        allRedirects.push({
          source: `/markets/${oldEntry.slug}`,
          destination,
          permanent: false,
        });
        count++;
      }
    }
    console.log(`metro: ${count} redirects`);
  }

  // -------------------------------------------------------------------------
  // County
  // -------------------------------------------------------------------------
  {
    const { periods, scoredByPeriod } = await fetchScoredByPeriod(
      API_BASE,
      "county",
    );
    const { lookback } = pickWindows(periods);
    const scoredRecently = new Set<string>();
    for (const p of lookback) {
      for (const id of scoredByPeriod.get(p) ?? []) scoredRecently.add(id);
    }

    const newCountyIds = new Set(newCounties.map((c) => c.fips));
    const oldCounties = readHeadJson<CountyEntry>(
      "packages/frontend/lib/data/county-slug-data.json",
    );

    let count = 0;
    for (const oldEntry of oldCounties) {
      if (newCountyIds.has(oldEntry.fips)) continue;
      if (!scoredRecently.has(oldEntry.fips)) continue;

      const ancestorKeys: AncestorKeys = {
        cbsaCode: oldEntry.cbsaCode,
        state: oldEntry.state,
      };
      const destination = resolveAncestorRedirect(
        ancestorKeys,
        publishedCountySlugByFips,
        publishedMetroSlugByCbsa,
        stateSlugOf,
      );
      if (destination !== null) {
        allRedirects.push({
          source: `/markets/county/${oldEntry.slug}`,
          destination,
          permanent: false,
        });
        count++;
      }
    }
    console.log(`county: ${count} redirects`);
  }

  // -------------------------------------------------------------------------
  // ZIP
  // -------------------------------------------------------------------------
  {
    const newZips = readCurrentJson<ZipEntry>("zip-slug-data.json");

    const { periods, scoredByPeriod } = await fetchScoredByPeriod(
      API_BASE,
      "zip",
    );
    const { lookback } = pickWindows(periods);
    const scoredRecently = new Set<string>();
    for (const p of lookback) {
      for (const id of scoredByPeriod.get(p) ?? []) scoredRecently.add(id);
    }

    const newZipIds = new Set(newZips.map((z) => z.zip));
    const oldZips = readHeadJson<ZipEntry>(
      "packages/frontend/lib/data/zip-slug-data.json",
    );

    let count = 0;
    for (const oldEntry of oldZips) {
      if (newZipIds.has(oldEntry.zip)) continue;
      if (!scoredRecently.has(oldEntry.zip)) continue;

      const ancestorKeys: AncestorKeys = {
        countyFips: oldEntry.countyFips,
        cbsaCode: oldEntry.cbsaCode,
        state: oldEntry.state,
      };
      const destination = resolveAncestorRedirect(
        ancestorKeys,
        publishedCountySlugByFips,
        publishedMetroSlugByCbsa,
        stateSlugOf,
      );
      if (destination !== null) {
        allRedirects.push({
          source: `/markets/zip/${oldEntry.slug}`,
          destination,
          permanent: false,
        });
        count++;
      }
    }
    console.log(`zip: ${count} redirects`);
  }

  // -------------------------------------------------------------------------
  // Write output — empty array is valid
  // -------------------------------------------------------------------------
  const outPath = path.join(DATA_DIR, "descored-redirects.json");
  fs.writeFileSync(outPath, JSON.stringify(allRedirects, null, 2) + "\n");
  console.log(`wrote ${allRedirects.length} total redirects → ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
