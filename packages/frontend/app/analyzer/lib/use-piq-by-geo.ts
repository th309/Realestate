"use client";

import { useMarketContext } from "@/lib/data";
import type { MarketContextChain } from "@/lib/data/fetchers/analyzer";

export interface PiqByGeo {
  zip: number | null;
  county: number | null;
  metro: number | null;
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
export function usePiqByGeo(chain: MarketContextChain | null | undefined): {
  piqByGeo: PiqByGeo;
} {
  const zip = chain?.zip;
  const countyFips = chain?.county_fips;
  const cbsaCode = chain?.cbsa_code;

  const zipQuery = useMarketContext({ zip, enabled: Boolean(zip) });
  const countyQuery = useMarketContext({
    county_fips: countyFips,
    enabled: Boolean(countyFips),
  });
  const metroQuery = useMarketContext({
    cbsa_code: cbsaCode,
    enabled: Boolean(cbsaCode),
  });

  return {
    piqByGeo: {
      zip: zipQuery.data?.piq_score?.value ?? null,
      county: countyQuery.data?.piq_score?.value ?? null,
      metro: metroQuery.data?.piq_score?.value ?? null,
    },
  };
}
