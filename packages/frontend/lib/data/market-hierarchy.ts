/**
 * Reverse-index lookups (parent -> children) and full ancestor-chain resolution
 * for the market page hierarchy (state -> metro -> county -> zip).
 *
 * Built from the existing forward-pointer slug data (a county/zip entry already
 * knows its own cbsaCode/countyFips) rather than a new generation step, so there
 * is exactly one source of truth for the hierarchy.
 */
import { makeLazyMap } from "./lazy-map";
import { CBSA_TO_METRO } from "./metro-slug-data";
import { COUNTY_SLUG_DATA, FIPS_TO_COUNTY } from "./county-slug-data";
import { ZIP_SLUG_DATA } from "./zip-slug-data";
import { ABBREV_TO_STATE } from "./state-slug-data";
import type { MetroSlugEntry } from "./metro-slugs";
import type { CountySlugEntry } from "./county-slugs";
import type { ZipSlugEntry } from "./zip-slugs";
import type { StateSlugEntry } from "./state-slug-data";

/** Shared cap for how many child links render inline before a "view all" link takes over. */
export const MARKET_LINKS_DISPLAY_CAP = 12;

const COUNTIES_BY_CBSA = makeLazyMap<string, CountySlugEntry[]>(() => {
  const map = new Map<string, CountySlugEntry[]>();
  for (const county of COUNTY_SLUG_DATA) {
    if (!county.cbsaCode) continue;
    const group = map.get(county.cbsaCode) ?? [];
    group.push(county);
    map.set(county.cbsaCode, group);
  }
  return map;
});

const ZIPS_BY_CBSA = makeLazyMap<string, ZipSlugEntry[]>(() => {
  const map = new Map<string, ZipSlugEntry[]>();
  for (const zip of ZIP_SLUG_DATA) {
    if (!zip.cbsaCode) continue;
    const group = map.get(zip.cbsaCode) ?? [];
    group.push(zip);
    map.set(zip.cbsaCode, group);
  }
  return map;
});

const ZIPS_BY_COUNTY_FIPS = makeLazyMap<string, ZipSlugEntry[]>(() => {
  const map = new Map<string, ZipSlugEntry[]>();
  for (const zip of ZIP_SLUG_DATA) {
    if (!zip.countyFips) continue;
    const group = map.get(zip.countyFips) ?? [];
    group.push(zip);
    map.set(zip.countyFips, group);
  }
  return map;
});

/** All counties belonging to a metro, in slug-data order. */
export function getCountiesForMetro(cbsaCode: string): CountySlugEntry[] {
  return COUNTIES_BY_CBSA.get(cbsaCode) ?? [];
}

/** All ZIPs belonging to a metro, in slug-data order. */
export function getZipsForMetro(cbsaCode: string): ZipSlugEntry[] {
  return ZIPS_BY_CBSA.get(cbsaCode) ?? [];
}

/** All ZIPs belonging to a county, in slug-data order. */
export function getZipsForCounty(countyFips: string): ZipSlugEntry[] {
  return ZIPS_BY_COUNTY_FIPS.get(countyFips) ?? [];
}

/**
 * Ancestors of the CURRENT page's geo, excluding the geo itself. A metro page's
 * chain has metro=null (the metro IS the page, not its own ancestor); a county
 * page's chain includes metro when the county belongs to one; a zip page's chain
 * includes both. Any tier can be null (non-CBSA county, ZIP with unresolved
 * county) — callers must render only the non-null tiers.
 */
export interface AncestorChain {
  state: StateSlugEntry | null;
  metro: MetroSlugEntry | null;
  county: CountySlugEntry | null;
}

export function getAncestorChainForMetro(metro: MetroSlugEntry): AncestorChain {
  return {
    state: ABBREV_TO_STATE.get(metro.state) ?? null,
    metro: null,
    county: null,
  };
}

export function getAncestorChainForCounty(
  county: CountySlugEntry,
): AncestorChain {
  const metro = county.cbsaCode
    ? (CBSA_TO_METRO.get(county.cbsaCode) ?? null)
    : null;
  return {
    state: ABBREV_TO_STATE.get(county.state) ?? null,
    metro,
    county: null,
  };
}

export function getAncestorChainForZip(zip: ZipSlugEntry): AncestorChain {
  const metro = zip.cbsaCode ? (CBSA_TO_METRO.get(zip.cbsaCode) ?? null) : null;
  const county = zip.countyFips
    ? (FIPS_TO_COUNTY.get(zip.countyFips) ?? null)
    : null;
  return { state: ABBREV_TO_STATE.get(zip.state) ?? null, metro, county };
}
