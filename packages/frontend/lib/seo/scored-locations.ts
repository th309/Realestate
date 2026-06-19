/**
 * Scored-location gating for SEO surfaces.
 *
 * A ZIP / county / metro page is only worth indexing when it has a PropertyIQ
 * score — otherwise it renders a bare "—" and reads as thin content. These
 * helpers expose the set of scored location IDs (per geography, latest period)
 * so the sitemap can drop scoreless pages and each page can self-`noindex`.
 *
 * FAIL OPEN: the underlying fetch returns [] on any backend error, so an
 * outage can never empty the sitemap or de-index live pages. When the set is
 * unavailable we treat every location as indexable.
 */
import { fetchScoredLocationIds } from "@/lib/data";

export type SeoGeo = "metro" | "county" | "zip";

/**
 * Set of scored location IDs for a geography, or `null` when the lookup yields
 * nothing (backend error / empty) — the signal to fail open.
 */
export async function getScoredIdSet(geo: SeoGeo): Promise<Set<string> | null> {
  const ids = await fetchScoredLocationIds(geo);
  if (!ids.length) return null;
  return new Set(ids);
}

/**
 * Whether a single location should be indexed. True when it has a score, or
 * when the scored set is unavailable (fail open). The ID must match the score
 * `location_id` format: padded ZIP, county FIPS, or CBSA code.
 */
export async function isLocationIndexable(
  geo: SeoGeo,
  id: string,
): Promise<boolean> {
  const set = await getScoredIdSet(geo);
  if (!set) return true; // fail open
  return set.has(id);
}
