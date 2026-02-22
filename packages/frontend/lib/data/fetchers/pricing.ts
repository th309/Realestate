/**
 * Pricing data fetcher
 *
 * Fetches tier and feature data for the pricing page from the public pricing API.
 */

import { fetchAPIRaw } from './base';

export interface PricingFeature {
  slug: string;
  name: string;
  category: string;
  value: unknown;
  value_type: string;
}

export interface PricingTier {
  slug: string;
  name: string;
  price_monthly: string | null;
  price_yearly: string | null;
  description: string | null;
  features: PricingFeature[];
}

export interface TrialInfo {
  is_enabled: boolean;
  duration_days: number;
  trial_tier: string;
}

export interface PricingSummary {
  tiers: PricingTier[];
  trial: TrialInfo | null;
}

export async function fetchPricingSummary(): Promise<PricingSummary> {
  const response = await fetchAPIRaw('/api/pricing/tiers');
  const result = await response.json();
  if (!result.success) throw new Error(result.error || 'Failed to fetch pricing summary');
  return result.data;
}
