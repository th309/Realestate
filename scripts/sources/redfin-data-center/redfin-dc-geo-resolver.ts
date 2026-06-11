/**
 * Resolve Redfin Data Center region names to our standard geo IDs.
 *
 * State and county are resolved here with EXACT, suffix-aware matching, because
 * the legacy resolveRedfinGeoid falls back to substring (`%name%`) matching that
 * produces wrong ids for short names contained in longer ones (e.g. "Kansas"
 * matched "Ar-kansas"; "Hampton" matched "Sout-hampton County").
 *
 * County disambiguation is subtle: Census/tiger names counties bare ("Southampton")
 * and independent cities with a " city" suffix ("Hampton city"). Redfin signals
 * which is which via its own suffix — "Southampton County, VA" is a county,
 * "Hampton, VA" (no "County") is an independent city. We therefore build an
 * ORDERED candidate list from Redfin's suffix and return the first tiger match,
 * so "Richmond, VA" -> 51760 (city) while "Richmond County, VA" -> 51159 (county)
 * instead of both colliding on one FIPS.
 *
 * Metro keeps the legacy CBSA resolution by design: Redfin metro DIVISIONS
 * (LA / Anaheim) legitimately share a parent CBSA and are disambiguated
 * downstream by region_name in the metro conflict key.
 *
 * `resolved` is false when the final id is a generated REDFIN-… fallback.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveRedfinGeoid } from "../redfin/redfin-geoid-lookup";

/** Remove the " metro area" suffix the DC format appends to metro names. */
export function stripMetroSuffix(name: string): string {
  return name.replace(/\s+metro area$/i, "").trim();
}

/** Pull a trailing ", XX" 2-letter state code, or null. */
export function extractStateCode(name: string): string | null {
  const m = name.match(/,\s*([A-Z]{2})(?:\s+metro area)?$/);
  return m ? m[1] : null;
}

/**
 * Ordered exact-match candidates (lowercased) for a county/equivalent, derived
 * from Redfin's own suffix. First match wins, so the city/county designation is
 * respected:
 *   "Southampton County, VA" -> ["southampton", "southampton county"]
 *   "Hampton, VA"            -> ["hampton city", "hampton"]
 *   "St. Mary's Parish, LA"  -> ["st. mary's", "st. mary's parish"]
 */
export function buildCountyNameCandidates(regionName: string): string[] {
  const noState = regionName.replace(/,\s*[A-Z]{2}$/, "").trim();
  const m = noState.match(
    /^(.*?)\s+(County|Parish|Borough|Census Area|city)$/i,
  );
  let ordered: string[];
  if (m) {
    const base = m[1].trim();
    const suffix = m[2].toLowerCase();
    if (suffix === "city") {
      ordered = [`${base} city`, base];
    } else {
      // county / parish / borough / census area: tiger usually stores it bare,
      // but keep the suffixed form as a secondary match.
      ordered = [base, `${base} ${m[2]}`];
    }
  } else {
    // No type suffix => Redfin independent city (e.g. "Hampton, VA").
    ordered = [`${noState} city`, noState];
  }
  return [...new Set(ordered.map((v) => v.toLowerCase()))];
}

export interface ResolvedGeo {
  regionId: string;
  /** False when the id is a generated REDFIN-… fallback. */
  resolved: boolean;
}

// --- caches (per import run) -------------------------------------------------
const stateAbbrToFips = new Map<string, string>(); // 'VA' -> '51'
const countyMapByStateFips = new Map<string, Map<string, string>>(); // '51' -> (lowerName -> geoid)

/** Clear resolver caches (between runs/tests). */
export function clearDcGeoCaches(): void {
  stateAbbrToFips.clear();
  countyMapByStateFips.clear();
}

async function getStateFips(
  supabase: SupabaseClient,
  stateCode: string,
): Promise<string | null> {
  const key = stateCode.toUpperCase();
  const cached = stateAbbrToFips.get(key);
  if (cached !== undefined) return cached;
  const { data } = await supabase
    .from("tiger_states")
    .select("geoid")
    .eq("state_abbreviation", key)
    .maybeSingle();
  const fips = (data as { geoid?: string } | null)?.geoid ?? null;
  if (fips) stateAbbrToFips.set(key, fips);
  return fips;
}

async function getCountyMap(
  supabase: SupabaseClient,
  stateFips: string,
): Promise<Map<string, string>> {
  const cached = countyMapByStateFips.get(stateFips);
  if (cached) return cached;
  const { data } = await supabase
    .from("tiger_counties")
    .select("geoid, name")
    .eq("state_fips", stateFips);
  const map = new Map<string, string>();
  for (const row of (data ?? []) as { geoid: string; name: string }[]) {
    map.set(row.name.toLowerCase(), row.geoid);
  }
  countyMapByStateFips.set(stateFips, map);
  return map;
}

/** Exact (case-insensitive) state name -> FIPS. Null on miss. */
async function resolveStateExact(
  supabase: SupabaseClient,
  regionName: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("tiger_states")
    .select("geoid")
    .ilike("name", regionName.trim())
    .limit(1)
    .maybeSingle();
  return (data as { geoid?: string } | null)?.geoid ?? null;
}

/** Suffix-aware exact county/equivalent -> FIPS within its state. Null on miss. */
async function resolveCountyExact(
  supabase: SupabaseClient,
  regionName: string,
): Promise<string | null> {
  const stateCode = extractStateCode(regionName);
  if (!stateCode) return null;
  const stateFips = await getStateFips(supabase, stateCode);
  if (!stateFips) return null;
  const countyMap = await getCountyMap(supabase, stateFips);
  for (const candidate of buildCountyNameCandidates(regionName)) {
    const geoid = countyMap.get(candidate);
    if (geoid) return geoid;
  }
  return null;
}

/**
 * Resolve a (geoLevel, regionName) to a standard geo id.
 * country -> 'US'; census_region -> the region name; state/county -> exact tiger
 * match with legacy fallback; metro/other -> legacy resolveRedfinGeoid.
 */
export async function resolveDcGeo(
  supabase: SupabaseClient,
  geoLevel: string,
  regionName: string,
): Promise<ResolvedGeo> {
  if (geoLevel === "country") return { regionId: "US", resolved: true };
  if (geoLevel === "census_region") {
    return { regionId: regionName.trim(), resolved: true };
  }

  if (geoLevel === "state") {
    const exact = await resolveStateExact(supabase, regionName);
    if (exact) return { regionId: exact, resolved: true };
  }
  if (geoLevel === "county") {
    const exact = await resolveCountyExact(supabase, regionName);
    if (exact) return { regionId: exact, resolved: true };
  }

  const stateCode = extractStateCode(regionName) ?? undefined;
  const cleanName =
    geoLevel === "metro" ? stripMetroSuffix(regionName) : regionName;

  const regionId = await resolveRedfinGeoid(
    supabase,
    geoLevel,
    cleanName,
    stateCode,
  );
  return { regionId, resolved: !regionId.startsWith("REDFIN-") };
}
