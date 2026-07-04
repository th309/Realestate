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
 * Metro resolves the Redfin region NAME to a canonical CBSA via a name-based
 * crosswalk against tiger_cbsa (city token + state token, tiered + unique) —
 * NOT the legacy fuzzy `%name%` substring match. That substring match ignored
 * the state and mis-keyed principal cities onto unrelated CBSAs whose name
 * merely CONTAINED the city as a substring: "Charlotte" -> "Charlottesville,
 * VA" (16820) instead of "Charlotte-Concord-Gastonia, NC-SC" (16740);
 * "Kansas City" -> "Arkansas City-Winfield, KS"; "Portland, OR" -> "Portland-
 * South Portland, ME". Metro DIVISIONS whose city IS a component of the parent
 * CBSA name still resolve to that parent (e.g. Anaheim -> Los Angeles CBSA),
 * disambiguated downstream by region_name in the metro conflict key. When no
 * UNIQUE canonical CBSA matches (a true division with no served CBSA, or an
 * ambiguous name), the metro is left UNMAPPED (a REDFIN-METRO-… fallback id,
 * resolved=false) rather than written to a wrong CBSA.
 *
 * `resolved` is false when the final id is a generated REDFIN-… fallback.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveRedfinGeoid } from "../redfin/redfin-geoid-lookup";
import {
  resolveMetroCanonicalId,
  clearMetroCanonCache,
} from "./redfin-dc-metro-crosswalk";

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
  clearMetroCanonCache();
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

/** Parse a Redfin metro region name to a lowercased city for the crosswalk. */
function metroCityFromRegionName(regionName: string): string {
  return stripMetroSuffix(regionName)
    .replace(/,\s*[A-Za-z]{2}$/, "")
    .trim()
    .toLowerCase();
}

/** Stable unmapped fallback id for a metro with no canonical CBSA match.
 * Matches the legacy REDFIN-METRO-<name> format so re-imports stay idempotent. */
function metroFallbackId(regionName: string): string {
  const sanitized = stripMetroSuffix(regionName)
    .replace(/[^a-zA-Z0-9]/g, "-")
    .toUpperCase()
    .substring(0, 30);
  return `REDFIN-METRO-${sanitized}`;
}

/**
 * Resolve a (geoLevel, regionName) to a standard geo id.
 * country -> 'US'; census_region -> the region name; state/county -> exact tiger
 * match with legacy fallback; metro -> canonical CBSA name crosswalk (else
 * unmapped-skip); other -> legacy resolveRedfinGeoid.
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
  if (geoLevel === "metro") {
    const stateCode = extractStateCode(regionName);
    const city = stateCode ? metroCityFromRegionName(regionName) : "";
    const canonical =
      stateCode && city
        ? await resolveMetroCanonicalId(supabase, city, stateCode)
        : null;
    if (canonical) return { regionId: canonical, resolved: true };
    // No UNIQUE canonical CBSA -> leave the metro UNMAPPED rather than fuzzy-
    // writing a wrong CBSA. Same REDFIN-METRO-<name> id the legacy fallback
    // produced, so re-imports of true divisions stay idempotent.
    return { regionId: metroFallbackId(regionName), resolved: false };
  }

  const stateCode = extractStateCode(regionName) ?? undefined;
  const regionId = await resolveRedfinGeoid(
    supabase,
    geoLevel,
    regionName,
    stateCode,
  );
  return { regionId, resolved: !regionId.startsWith("REDFIN-") };
}
