"use client";

import { useMarketContext } from "@/lib/data";
import type { MarketContextChain } from "@/lib/data/fetchers/analyzer";

export interface PiqByGeo {
  zip: number | null;
  county: number | null;
  metro: number | null;
}

export interface PiqByGeoOptions {
  /**
   * False while a saved deal is showing the scores it was SAVED with. Opening
   * a saved deal is a page view, not a refresh (spec §4.4) — see
   * `useMarketRefreshGate`. Defaults to true for a fresh analysis.
   */
  enabled?: boolean;
  /** Scores restored from the saved deal, shown while `enabled` is false. */
  restored?: PiqByGeo | null;
}

/**
 * Fan out three parallel market-context queries (ZIP/County/Metro) so the
 * Property Header can show all three PIQ scores at once. County and Metro
 * fetches stay disabled until the initial ZIP fetch surfaces the parent
 * chain IDs — avoids firing queries with undefined IDs.
 *
 * React Query caches each level independently, so the user clicking pills
 * in MarketContextSection below hits the same cache rather than refetching.
 */
export function usePiqByGeo(
  chain: MarketContextChain | null | undefined,
  { enabled = true, restored = null }: PiqByGeoOptions = {},
): {
  piqByGeo: PiqByGeo;
  /**
   * True until every enabled level has settled. A `null` score is ambiguous on
   * its own — it means "this level has no score" AND "this level hasn't
   * loaded yet" — so anything that snapshots `piqByGeo` into a payload needs
   * this to tell the two apart.
   *
   * Without it the batched AI call fires on a half-resolved snapshot: it burns
   * an LLM generation on scores that are about to change (the fingerprint is
   * built from them, so the key never matches the settled one and the cache
   * can't hit), and risks a narrative citing PIQ scores that disagree with the
   * ones rendered in the header.
   */
  isResolving: boolean;
} {
  const zip = chain?.zip;
  const countyFips = chain?.county_fips;
  const cbsaCode = chain?.cbsa_code;

  const zipQuery = useMarketContext({ zip, enabled: enabled && Boolean(zip) });
  const countyQuery = useMarketContext({
    county_fips: countyFips,
    enabled: enabled && Boolean(countyFips),
  });
  const metroQuery = useMarketContext({
    cbsa_code: cbsaCode,
    enabled: enabled && Boolean(cbsaCode),
  });

  // A disabled query (no id at that level) is settled by definition — it will
  // never produce a score, so waiting on it would hang the gate forever for
  // any unmetropolitan ZIP.
  const pending =
    (Boolean(zip) && zipQuery.isLoading) ||
    (Boolean(countyFips) && countyQuery.isLoading) ||
    (Boolean(cbsaCode) && metroQuery.isLoading);

  // While the live queries are switched off — or still in flight on the way
  // back from an explicit refresh — the saved score is the honest answer. A
  // null would render as "no score" and, worse, would churn the deal state
  // through an all-null intermediate that autosave would faithfully persist.
  const scoreFor = (
    query: ReturnType<typeof useMarketContext>,
    saved: number | null,
  ) =>
    enabled && !query.isLoading
      ? (query.data?.piq_score?.value ?? null)
      : saved;

  return {
    piqByGeo: {
      zip: scoreFor(zipQuery, restored?.zip ?? null),
      county: scoreFor(countyQuery, restored?.county ?? null),
      metro: scoreFor(metroQuery, restored?.metro ?? null),
    },
    // The chain itself arrives async. Before it lands there are no ids to
    // query, so every level reads null — indistinguishable from "no scores
    // anywhere" without this guard. Suppressed levels are settled, not
    // pending: their restored scores are already final.
    isResolving: enabled && (!chain || pending),
  };
}
