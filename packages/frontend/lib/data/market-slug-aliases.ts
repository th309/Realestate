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

  const addAlias = (alias: string, canonicalSlug: string) => {
    if (alias === canonicalSlug) return; // nothing to alias
    if (canonical.has(alias)) return; // never shadow a real canonical slug
    if (aliases.has(alias)) return; // keep first; county+state is unique anyway
    aliases.set(alias, canonicalSlug);
  };

  // Bare-alias pass runs cities BEFORE counties, deliberately: a same-named
  // city/county pair (Richmond, Roanoke, Franklin VA) would otherwise both
  // try to claim the same bare alias ("richmond-va"), and `addAlias`'s
  // keep-first guard would resolve it by array order — accidental, not a
  // real decision. Cities are what most searchers mean by the bare name, so
  // they get first claim; the county's identical attempt is then correctly
  // skipped by the keep-first guard instead of silently winning by luck.
  for (const county of COUNTY_SLUG_DATA) {
    if (!county.isCity) continue;
    addAlias(county.slug.replace("-city-", "-"), county.slug);
  }

  for (const county of COUNTY_SLUG_DATA) {
    // Alias = canonical slug minus its "-county-"/"-city-" segment: people
    // type "mecklenburg-nc" or "richmond-va", not "mecklenburg-county-nc" or
    // "richmond-city-va". Gated on `isCity` (not a slug substring check) so
    // this never misfires on a real county whose proper name contains the
    // word "City" — James City County, Charles City County. (Cities already
    // claimed their bare alias in the pass above; this re-attempt for a city
    // is a harmless no-op via the `alias === canonicalSlug`/`aliases.has`
    // guards.)
    const segment = county.isCity ? "-city-" : "-county-";
    addAlias(county.slug.replace(segment, "-"), county.slug);

    // Louisiana's counties are legally "parishes" and used to be slugged that
    // way ("acadia-parish-la") before the slug generator standardized on
    // "-county-" for all states. Google indexed the old parish URLs; alias
    // them back to the canonical slug so they 308 instead of 404.
    if (county.state === "LA") {
      addAlias(county.slug.replace("-county-", "-parish-"), county.slug);
    }

    // Independent cities (VA + Baltimore/St. Louis/Carson City) used to be
    // slugged "-county-" like everything else — either colliding with a
    // same-named real county, or inventing a nonexistent "X County" name
    // (see generate-county-slugs.ts). Google indexed those old "-county-"
    // URLs; alias them back to the corrected "-city-" canonical slug. This is
    // self-guarding for the collision cases: where a real same-named county
    // now legitimately owns that "-county-" slug, `addAlias` skips it (the
    // `canonical.has(alias)` check) rather than hijacking the real county's
    // URL — e.g. "richmond-county-va" stays Richmond County, not an alias to
    // Richmond City.
    if (county.isCity) {
      addAlias(county.slug.replace("-city-", "-county-"), county.slug);
    }
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
