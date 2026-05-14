import { useQuery } from "@tanstack/react-query";
import {
  fetchMarketContext,
  type MarketContext,
  type MarketContextParams,
  type MarketContextResult,
} from "@/lib/data";

/**
 * Query the backend for the market context (home value, rent index, market
 * heat, net migration, PIQ score) at the most specific geo level available
 * for the given address inputs.
 *
 * Returns `{ quotaExceeded: true }` on HTTP 402 so the UI can show a paywall
 * without conflating it with a generic error.
 */
export function useMarketContext(params: MarketContextParams) {
  return useQuery<MarketContextResult>({
    queryKey: ["analyzer", "market-context", params],
    queryFn: () => fetchMarketContext(params),
    enabled: Boolean(params.zip || params.county_fips || params.state),
    // 2h cache per CLAUDE.md §5 data-binding hooks guidance.
    staleTime: 1000 * 60 * 60 * 2,
  });
}

export function isQuotaExceeded(v: unknown): v is { quotaExceeded: true } {
  return Boolean(
    v &&
    typeof v === "object" &&
    (v as { quotaExceeded?: unknown }).quotaExceeded === true,
  );
}

export function isMarketContext(v: unknown): v is MarketContext {
  return Boolean(
    v &&
    typeof v === "object" &&
    "geo_level" in (v as object) &&
    !(v as { quotaExceeded?: unknown }).quotaExceeded,
  );
}
