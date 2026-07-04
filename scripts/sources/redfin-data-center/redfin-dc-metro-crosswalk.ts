/**
 * Canonical CBSA name crosswalk for Redfin Data Center metros.
 *
 * Redfin labels metro rows by NAME ("Charlotte, NC metro area"), not by CBSA
 * code. This module maps that name to the correct canonical CBSA geoid by
 * matching against tiger_cbsa (the complete Census CBSA gazetteer) on a city
 * token + a state token — replacing the legacy fuzzy `%name%` substring match
 * that ignored the state and mis-keyed principal cities onto unrelated CBSAs
 * whose name merely contained the city as a substring ("Charlotte" ->
 * "Charlottesville, VA"; "Kansas City" -> "Arkansas City-Winfield, KS";
 * "Portland, OR" -> "Portland-South Portland, ME").
 *
 * The caller supplies an already-parsed (city, stateCode); this file has no
 * dependency on the resolver, so there is no import cycle.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

interface MetroCanon {
  geoid: string;
  /** Full pre-comma name, lowercased ("kansas city"). */
  fullCity: string;
  /** Hyphen-split city components, lowercased ("charlotte","concord",...). */
  cityComponents: string[];
  /** Hyphen/slash/space-split single words, lowercased. */
  cityWords: string[];
  /** Uppercased 2-letter state tokens ("NC","SC"). */
  stateCodes: string[];
}

let metroCanonCache: MetroCanon[] | null = null;

/**
 * tiger_cbsa page size. The full CBSA gazetteer (~930 rows) sits just under the
 * PostgREST 1000-row read cap, so an UNPAGINATED select would silently truncate
 * as the gazetteer grows — truncated CBSAs would fall to the unmapped fallback
 * and re-blank their metro cards. We range-paginate instead (matches
 * scripts/geo-data-loader/loaders/metro-loader.ts, which pages this same table).
 */
const CBSA_PAGE_SIZE = 500;

/** Clear the tiger_cbsa crosswalk cache (between import runs / tests). */
export function clearMetroCanonCache(): void {
  metroCanonCache = null;
}

/** Split a CBSA name ("Charlotte-Concord-Gastonia, NC-SC") into match tokens. */
function parseCbsaName(name: string): Omit<MetroCanon, "geoid"> {
  const idx = name.lastIndexOf(",");
  const pre = (idx >= 0 ? name.slice(0, idx) : name).trim();
  const statePart = idx >= 0 ? name.slice(idx + 1) : "";
  const lower = (s: string) => s.trim().toLowerCase();
  return {
    fullCity: pre.toLowerCase(),
    cityComponents: pre.split("-").map(lower).filter(Boolean),
    cityWords: pre
      .split(/[-/\s]+/)
      .map(lower)
      .filter(Boolean),
    stateCodes: statePart
      .split(/[-\s]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean),
  };
}

/** Load + cache the full tiger_cbsa name crosswalk (once per import run). */
async function getMetroCanonList(
  supabase: SupabaseClient,
): Promise<MetroCanon[]> {
  if (metroCanonCache) return metroCanonCache;
  // Range-paginate until a short page so the cache holds EVERY tiger_cbsa row,
  // not just the first PostgREST page (see CBSA_PAGE_SIZE).
  const rows: { geoid: string; name: string }[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("tiger_cbsa")
      .select("geoid, name")
      .order("geoid")
      .range(offset, offset + CBSA_PAGE_SIZE - 1);
    if (error) {
      throw new Error(
        `redfin-dc metro crosswalk: failed reading tiger_cbsa: ${error.message}`,
      );
    }
    if (!data || data.length === 0) break;
    rows.push(...(data as { geoid: string; name: string }[]));
    if (data.length < CBSA_PAGE_SIZE) break;
    offset += CBSA_PAGE_SIZE;
  }
  metroCanonCache = rows.map((row) => ({
    geoid: row.geoid,
    ...parseCbsaName(row.name),
  }));
  return metroCanonCache;
}

/**
 * Resolve a Redfin metro (city, stateCode) to its canonical CBSA geoid, or null.
 *
 * `city` must be lowercased (e.g. "charlotte", "kansas city") and `stateCode`
 * an uppercase 2-letter code ("NC"). Matching is anchored + state-filtered and
 * tiered (full pre-comma name, then hyphen components, then single words); the
 * first tier with a UNIQUE match wins. A non-unique (ambiguous) or empty result
 * returns null so the caller emits an unmapped fallback instead of guessing a
 * wrong CBSA. The state filter separates the two Portlands ("Portland"/"OR" ->
 * 38900, not ME 38860); the token (vs substring) match stops "Charlotte" from
 * hitting "Charlottesville". Metro DIVISIONS whose city IS a component of the
 * parent CBSA name (Anaheim, Camden, Warren MI) resolve to that parent CBSA.
 */
export async function resolveMetroCanonicalId(
  supabase: SupabaseClient,
  city: string,
  stateCode: string,
): Promise<string | null> {
  if (!city || !stateCode) return null;
  const inState = (await getMetroCanonList(supabase)).filter((c) =>
    c.stateCodes.includes(stateCode),
  );

  const tiers: ((c: MetroCanon) => boolean)[] = [
    (c) => c.fullCity === city,
    (c) => c.cityComponents.includes(city),
    (c) => c.cityWords.includes(city),
  ];
  for (const matches of tiers) {
    const ids = new Set(inState.filter(matches).map((c) => c.geoid));
    if (ids.size === 1) return [...ids][0];
    if (ids.size > 1) return null; // ambiguous -> unmapped, never guess
  }
  return null;
}
