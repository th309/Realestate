/**
 * Resolve Redfin Data Center region names to our standard geo IDs.
 *
 * State and county are resolved here with EXACT / suffix-aware matching, because
 * the legacy resolveRedfinGeoid falls back to substring (`%name%`) matching that
 * produces wrong ids for short names contained in longer ones:
 *   - "Kansas" matched "Ar-kansas" -> both got FIPS 05
 *   - "Hampton" matched "Sout-hampton County" -> Hampton city got 51175
 * For those two levels we do anchored exact lookups against the tiger tables and
 * only fall through to the legacy resolver (markets + deterministic fallback) on
 * a genuine miss. Metro keeps the legacy CBSA resolution by design: Redfin metro
 * divisions (LA / Anaheim) legitimately share a parent CBSA and are disambiguated
 * downstream by including region_name in the metro conflict key.
 *
 * `resolved` is false when the final id is a generated REDFIN-… fallback so the
 * caller can enforce an unresolved-rate threshold.
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
 * Exact-match candidate names for a county/equivalent, given a Redfin region
 * name like "Hampton, VA" or "Southampton County, VA". Strips the trailing
 * state, then offers the bare name plus the common Census suffix variants so we
 * match "Hampton city" / "Southampton County" exactly instead of substring-
 * matching a longer county name. Lowercased for case-insensitive comparison.
 */
export function buildCountyNameCandidates(regionName: string): string[] {
  const noState = regionName.replace(/,\s*[A-Z]{2}$/, "").trim();
  const base = noState.replace(/\s+(County|Parish|Borough|city)$/i, "").trim();
  const variants = [
    noState,
    base,
    `${base} County`,
    `${base} Parish`,
    `${base} Borough`,
    `${base} city`,
  ];
  return [...new Set(variants.map((v) => v.toLowerCase()))];
}

export interface ResolvedGeo {
  regionId: string;
  /** False when the id is a generated REDFIN-… fallback. */
  resolved: boolean;
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

/** Exact / suffix-aware county name -> FIPS within its state. Null on miss. */
async function resolveCountyExact(
  supabase: SupabaseClient,
  regionName: string,
): Promise<string | null> {
  const stateCode = extractStateCode(regionName);
  if (!stateCode) return null;

  const { data: stateRow } = await supabase
    .from("tiger_states")
    .select("geoid")
    .eq("state_abbreviation", stateCode.toUpperCase())
    .maybeSingle();
  const stateFips = (stateRow as { geoid?: string } | null)?.geoid;
  if (!stateFips) return null;

  const { data: counties } = await supabase
    .from("tiger_counties")
    .select("geoid, name")
    .eq("state_fips", stateFips);
  if (!counties) return null;

  const candidates = new Set(buildCountyNameCandidates(regionName));
  for (const row of counties as { geoid: string; name: string }[]) {
    if (candidates.has(row.name.toLowerCase())) return row.geoid;
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
