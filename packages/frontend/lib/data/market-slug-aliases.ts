// Reverse alias maps for natural city-name market URLs.
//
// The canonical metro/county pages live at the full CBSA / FIPS-derived slug
// ("charlotte-concord-gastonia-nc-sc", "mecklenburg-county-nc"). People naturally
// type the short, intuitive form instead ("charlotte-nc", "mecklenburg-nc"), which
// would otherwise hard-404. These maps let the route 308-redirect a recognized
// alias to its canonical slug — the same idea the ZIP route uses for a bare 5-digit
// ZIP (see app/(public)/markets/zip/[slug]/page.tsx).
//
// Built ONCE, lazily, on first access (no per-request work, no DB calls). The
// underlying derivation reuses the exact slug-normalization rules that produced
// the canonical slugs, so a single-city metro's alias is byte-identical to its
// canonical slug and is therefore skipped (no redundant self-redirect).

import { METRO_SLUG_DATA } from "./metro-slug-data";
import { COUNTY_SLUG_DATA } from "./county-slug-data";
import { generateMetroSlug, type MetroSlugEntry } from "./metro-slugs";
import { makeLazyMap } from "./lazy-map";

/**
 * Number of principal cities named in a metro's full name, used only as a
 * deterministic "most prominent" tie-breaker on the (rare) chance two metros
 * share the same first-city + state alias. A combined CSA/MSA names more
 * principal cities ("Charlotte-Concord-Gastonia" = 3) than a same-named
 * micropolitan area ("Concord" = 1), and the larger area is what a searcher
 * almost always means. Population would be the ideal tie-breaker, but it is not
 * present in the slug datasets and must not be fetched at module load — this
 * proxy is the documented fallback. (Currently zero metro aliases collide.)
 */
function principalCityCount(entry: MetroSlugEntry): number {
  const comma = entry.name.indexOf(",");
  const cityPart = comma === -1 ? entry.name : entry.name.slice(0, comma);
  return cityPart.split("-").length;
}

/**
 * Aliases for a metro = its first principal city paired with EACH state code.
 * "Charlotte-Concord-Gastonia, NC-SC" → {"charlotte-nc", "charlotte-sc"}.
 * "Austin-Round Rock-San Marcos, TX" → {"austin-tx"}.
 * We slugify via the same generateMetroSlug used to build canonical slugs, so a
 * hypothetical single-city metro's alias would exactly equal its canonical slug.
 */
function metroAliasesFor(entry: MetroSlugEntry): string[] {
  const comma = entry.name.indexOf(",");
  const cityPart = comma === -1 ? entry.name : entry.name.slice(0, comma);
  const statePart =
    comma === -1 ? entry.state : entry.name.slice(comma + 1).trim();

  const firstCity = cityPart.split("-")[0].trim();
  const stateCodes = statePart
    .split("-")
    .map((s) => s.trim())
    .filter(Boolean);

  return stateCodes.map((stateCode) =>
    generateMetroSlug(`${firstCity}, ${stateCode}`),
  );
}

/** Map of metro alias slug → canonical metro slug. Built lazily, once. */
export const METRO_SLUG_ALIASES = makeLazyMap<string, string>(() => {
  const canonical = new Set(METRO_SLUG_DATA.map((m) => m.slug));
  const aliases = new Map<string, string>();
  const prominence = new Map<string, number>();

  for (const metro of METRO_SLUG_DATA) {
    const score = principalCityCount(metro);
    for (const alias of metroAliasesFor(metro)) {
      // Never let an alias shadow a real canonical slug (incl. the metro's own).
      if (canonical.has(alias)) continue;

      const existing = aliases.get(alias);
      if (existing === undefined || existing === metro.slug) {
        aliases.set(alias, metro.slug);
        prominence.set(alias, score);
        continue;
      }
      // Collision: keep the more prominent (more principal cities) metro.
      if (score > (prominence.get(alias) ?? 0)) {
        aliases.set(alias, metro.slug);
        prominence.set(alias, score);
      }
    }
  }
  return aliases;
});

/** Map of county alias slug → canonical county slug. Built lazily, once. */
export const COUNTY_SLUG_ALIASES = makeLazyMap<string, string>(() => {
  const canonical = new Set(COUNTY_SLUG_DATA.map((c) => c.slug));
  const aliases = new Map<string, string>();

  for (const county of COUNTY_SLUG_DATA) {
    // Alias = canonical slug minus the "-county-" segment: people type
    // "mecklenburg-nc", not "mecklenburg-county-nc".
    const alias = county.slug.replace("-county-", "-");
    if (alias === county.slug) continue; // no "-county-" token; nothing to alias
    if (canonical.has(alias)) continue; // never shadow a real canonical slug
    if (aliases.has(alias)) continue; // keep first; county+state is unique anyway
    aliases.set(alias, county.slug);
  }
  return aliases;
});

/**
 * Resolve a typed metro slug to its canonical slug, or null if it is not a
 * known alias. Callers should only reach here after confirming the slug is not
 * itself a canonical entry.
 */
export function resolveMetroAlias(slug: string): string | null {
  return METRO_SLUG_ALIASES.get(slug) ?? null;
}

/** Resolve a typed county slug to its canonical slug, or null if unknown. */
export function resolveCountyAlias(slug: string): string | null {
  return COUNTY_SLUG_ALIASES.get(slug) ?? null;
}
