#!/usr/bin/env npx tsx
/**
 * READ-ONLY: Resolve the redfin_county rows that have NULL fips_code to their
 * authoritative Census FIPS, using the clean 2024 TIGER county shapefile DBF as
 * the source of truth. Prints a mapping for review. Writes NOTHING to the DB.
 *
 * Why the DBF and not tiger_counties: the tiger_counties table is a dirty,
 * multi-vintage scrape (junk suffixes, en-dashes, dropped possessives), so
 * name matching against it fails for ~14 of these. The shapefile carries the
 * canonical Census NAME + GEOID.
 */

import { open } from "shapefile";
import { join } from "path";
import { getSupabaseClient } from "./lib/db-client";

const SHP = join(__dirname, "shapefiles", "tl_2024_us_county.shp");

// Stable 2-letter -> state FIPS (invariant Census codes).
const STATE_ABBR_TO_FIPS: Record<string, string> = {
  AL: "01",
  AK: "02",
  AZ: "04",
  AR: "05",
  CA: "06",
  CO: "08",
  CT: "09",
  DE: "10",
  DC: "11",
  FL: "12",
  GA: "13",
  HI: "15",
  ID: "16",
  IL: "17",
  IN: "18",
  IA: "19",
  KS: "20",
  KY: "21",
  LA: "22",
  ME: "23",
  MD: "24",
  MA: "25",
  MI: "26",
  MN: "27",
  MS: "28",
  MO: "29",
  MT: "30",
  NE: "31",
  NV: "32",
  NH: "33",
  NJ: "34",
  NM: "35",
  NY: "36",
  NC: "37",
  ND: "38",
  OH: "39",
  OK: "40",
  OR: "41",
  PA: "42",
  RI: "44",
  SC: "45",
  SD: "46",
  TN: "47",
  TX: "48",
  UT: "49",
  VT: "50",
  VA: "51",
  WA: "53",
  WV: "54",
  WI: "55",
  WY: "56",
};

/** Collapse to lowercase alphanumerics only (drops hyphens, en-dashes, apostrophes, spaces, periods). */
function normAlnum(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

/** Strip trailing state and a single county-equivalent suffix; flag the Redfin "City County" independent-city quirk. */
function redfinBase(countyName: string): {
  base: string;
  isCityCounty: boolean;
} {
  let s = countyName.replace(/,\s*[A-Z]{2}$/, "").trim();
  const isCityCounty = /\bcity county$/i.test(s);
  if (isCityCounty) {
    s = s.replace(/\bcity county$/i, "");
  } else {
    s = s.replace(
      /\s+(county|parish|borough|census area|municipality|city)$/i,
      "",
    );
  }
  return { base: normAlnum(s), isCityCounty };
}

async function main() {
  const supabase = getSupabaseClient();

  // Paginate: tens of thousands of NULL-fips rows; the client caps at 1000/page.
  const targets = new Map<
    string,
    { county_name: string; state_code: string }
  >();
  let qpage = 0;
  while (true) {
    const from = qpage * 1000;
    const { data: nullRows, error } = await supabase
      .from("redfin_county")
      .select("county_name, state_code")
      .is("fips_code", null)
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!nullRows || nullRows.length === 0) break;
    for (const r of nullRows) {
      const key = `${r.county_name}|${r.state_code}`;
      if (!targets.has(key)) targets.set(key, r as any);
    }
    if (nullRows.length < 1000) break;
    qpage += 1;
  }
  console.log(`Distinct NULL-fips counties found: ${targets.size}`);

  // Index DBF: stateFips -> base -> [{geoid, name}]
  const byStateBase = new Map<
    string,
    Map<string, { geoid: string; name: string }[]>
  >();
  const src = await open(SHP);
  while (true) {
    const res = await src.read();
    if (res.done) break;
    const p: any = res.value.properties;
    const geoid: string = p.GEOID;
    const name: string = p.NAME;
    const statefp: string = p.STATEFP;
    const base = normAlnum(name);
    if (!byStateBase.has(statefp)) byStateBase.set(statefp, new Map());
    const m = byStateBase.get(statefp)!;
    if (!m.has(base)) m.set(base, []);
    m.get(base)!.push({ geoid, name });
  }

  const resolved: any[] = [];
  const unresolved: any[] = [];

  for (const { county_name, state_code } of targets.values()) {
    const stateFips = STATE_ABBR_TO_FIPS[state_code];
    const { base, isCityCounty } = redfinBase(county_name);
    const candidates = stateFips
      ? (byStateBase.get(stateFips)?.get(base) ?? [])
      : [];

    let pick: { geoid: string; name: string } | undefined;
    let method = "";
    if (candidates.length === 1) {
      pick = candidates[0];
      method = "unique";
    } else if (candidates.length > 1) {
      if (isCityCounty) {
        // Independent city: county-part FIPS >= 510
        pick = candidates.find((c) => parseInt(c.geoid.slice(2), 10) >= 510);
        method = "citycounty>=510";
      }
      if (!pick) {
        unresolved.push({
          county_name,
          state_code,
          base,
          candidates,
          reason: "ambiguous",
        });
        continue;
      }
    }

    if (pick) {
      resolved.push({
        county_name,
        state_code,
        geoid: pick.geoid,
        dbf_name: pick.name,
        method,
      });
    } else {
      unresolved.push({
        county_name,
        state_code,
        base,
        reason: "no_dbf_match",
      });
    }
  }

  resolved.sort((a, b) => a.geoid.localeCompare(b.geoid));
  console.log("\n=== RESOLVED (" + resolved.length + ") ===");
  for (const r of resolved) {
    console.log(
      `${r.geoid}  ${r.state_code}  ${r.county_name}  ->  ${r.dbf_name}  [${r.method}]`,
    );
  }
  console.log("\n=== UNRESOLVED (" + unresolved.length + ") ===");
  for (const u of unresolved) {
    console.log(JSON.stringify(u));
  }

  // Emit machine-readable mapping for the backfill step.
  console.log("\n=== JSON ===");
  console.log(
    JSON.stringify(
      resolved.map((r) => ({
        county_name: r.county_name,
        state_code: r.state_code,
        geoid: r.geoid,
      })),
      null,
      0,
    ),
  );
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
