/**
 * useMarketContext — fetch the analyzer's market-context payload
 * (home value, rent index, market heat, net migration, PropertyIQ score)
 * for a given geography.
 *
 * Pass exactly one of `zip`, `county_fips`, `state`. Pass `null` for all
 * to disable the query (e.g., before RentCast has resolved a property).
 *
 * Returns the typed `MarketContext` shape when the call succeeds, the
 * sentinel `{ quotaExceeded: true }` when the free-tier wall is hit, or
 * `null` on auth/server errors. Callers should narrow accordingly.
 */

import { useQuery } from "@tanstack/react-query";
import {
  fetchMarketContext,
  type MarketContext,
  type MarketContextParams,
  type MarketContextResult,
} from "../fetchers/analyzer";

export interface UseMarketContextOptions extends MarketContextParams {
  /** Skip the query (e.g., when geography isn't known yet). */
  enabled?: boolean;
}

export interface UseMarketContextResult {
  data: MarketContext | null;
  quotaExceeded: boolean;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useMarketContext(
  options: UseMarketContextOptions = {},
): UseMarketContextResult {
  const { enabled = true, zip, county_fips, cbsa_code, state } = options;

  const hasGeo = Boolean(zip || county_fips || cbsa_code || state);

  const query = useQuery<MarketContextResult>({
    queryKey: [
      "analyzer",
      "market-context",
      { zip, county_fips, cbsa_code, state },
    ],
    queryFn: () => fetchMarketContext({ zip, county_fips, cbsa_code, state }),
    enabled: enabled && hasGeo,
    // Market metrics change at most weekly; an in-session cache of 2h matches
    // the rest of the data layer (CLAUDE.md §5 data-binding hooks guidance).
    staleTime: 2 * 60 * 60 * 1000,
    gcTime: 4 * 60 * 60 * 1000,
  });

  const raw = query.data ?? null;
  const quotaExceeded =
    raw !== null && typeof raw === "object" && "quotaExceeded" in raw;
  const data: MarketContext | null =
    raw !== null && typeof raw === "object" && "geo_level" in raw
      ? (raw as MarketContext)
      : null;

  return {
    data,
    quotaExceeded,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
