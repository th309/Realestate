// scripts/generate-descored-redirects.ts
// Generates a redirect map for de-scored geo pages → their nearest published ancestor.
// Run monthly AFTER the slug generators have regenerated the gated JSONs.
// Usage: npx tsx scripts/generate-descored-redirects.ts

import fs from "fs";
import path from "path";

import {
  pickWindows,
  resolveAncestorRedirect,
  type AncestorKeys,
} from "./lib/published-set";
import { fetchScoredByPeriod } from "./lib/scored-set-client";
import {
  buildStateSlugMap,
  pushTempRedirects,
  readCurrentJson,
  readHeadJson,
  type CountyEntry,
  type MetroEntry,
  type Redirect,
  type ZipEntry,
} from "./lib/descored-redirect-io";

const API_BASE = process.env.API_URL ?? "http://localhost:3001";

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
        // Overflow pages (if this metro ever had >12 counties/zips) must
        // redirect alongside the main page. A rule for an overflow page that
        // never existed is a harmless no-op — it just never matches a request.
        pushTempRedirects(
          allRedirects,
          destination,
          `/markets/${oldEntry.slug}`,
          `/markets/${oldEntry.slug}/counties`,
          `/markets/${oldEntry.slug}/zips`,
        );
        // Forecast pages share the metro slug set; a de-scored metro's
        // forecast page falls back to the national hub (no forecast ancestor).
        pushTempRedirects(
          allRedirects,
          "/forecast",
          `/forecast/${oldEntry.slug}`,
        );
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
        // Overflow page (if this county ever had >12 zips) must redirect
        // alongside the main page — same no-op reasoning as the metro block above.
        pushTempRedirects(
          allRedirects,
          destination,
          `/markets/county/${oldEntry.slug}`,
          `/markets/county/${oldEntry.slug}/zips`,
        );
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
        pushTempRedirects(
          allRedirects,
          destination,
          `/markets/zip/${oldEntry.slug}`,
        );
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
