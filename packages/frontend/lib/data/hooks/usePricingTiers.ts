/**
 * USE PRICING TIERS HOOK
 *
 * React Query hook for fetching subscription tier pricing from the database.
 * Ensures all price displays across the site stay in sync with admin changes.
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import {
  fetchPricingSummary,
  type PricingSummary,
  type PricingTier,
} from '../fetchers/pricing';

export interface UsePricingTiersResult {
  tiers: PricingTier[];
  trial: PricingSummary['trial'];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Returns a lookup of tier prices keyed by slug.
 * Useful for components that only need price strings (e.g. account page).
 */
export interface TierPriceLookup {
  [slug: string]: {
    name: string;
    priceMonthly: number;
    priceYearly: number;
  };
}

export function usePricingTiers(): UsePricingTiersResult {
  const { data, isLoading, error } = useQuery({
    queryKey: ['pricing-tiers'],
    queryFn: fetchPricingSummary,
    staleTime: 1000 * 60 * 60 * 2, // 2 hours
    gcTime: 1000 * 60 * 60 * 4,    // 4 hours
  });

  return {
    tiers: data?.tiers ?? [],
    trial: data?.trial ?? null,
    isLoading,
    error: error as Error | null,
  };
}

/** Build a slug → price lookup from tier data. */
export function buildPriceLookup(tiers: PricingTier[]): TierPriceLookup {
  const lookup: TierPriceLookup = {};
  for (const t of tiers) {
    lookup[t.slug] = {
      name: t.name,
      priceMonthly: Number(t.price_monthly) || 0,
      priceYearly: Number(t.price_yearly) || 0,
    };
  }
  return lookup;
}
