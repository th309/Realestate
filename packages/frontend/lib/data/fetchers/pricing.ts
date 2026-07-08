/**
 * Pricing data fetcher
 *
 * Fetches tier and feature data for the pricing page from the public pricing API.
 */

import { fetchAPICached, fetchAPIRaw } from "./base";

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
  pricing_card_items: string[];
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
  const response = await fetchAPIRaw("/api/pricing/tiers");
  const result = await response.json();
  if (!result.success)
    throw new Error(result.error || "Failed to fetch pricing summary");
  return result.data;
}

/** A paid tier shaped for schema.org Offer markup (homepage JSON-LD). */
export interface PaidTierOffer {
  slug: string;
  name: string;
  priceMonthly: number;
}

/**
 * Server-side (ISR-cached, 1h) paid tiers for schema.org Offer markup.
 * Returns null on any failure so callers omit paid offers entirely rather
 * than publishing stale or fabricated prices.
 */
export async function fetchPaidTierOffers(): Promise<PaidTierOffer[] | null> {
  try {
    // 1h revalidate (not the 24h SEO window): price changes should reach the
    // homepage schema fast. Dedicated tag enables coordinated invalidation.
    const result = await fetchAPICached<{
      success: boolean;
      data: PricingSummary;
    }>("/api/pricing/tiers", undefined, {
      revalidate: 3600,
      tags: ["piq-pricing"],
    });
    if (!result?.success || !Array.isArray(result.data?.tiers)) return null;
    const paid = result.data.tiers
      .filter((tier) => Number(tier.price_monthly) > 0)
      .map((tier) => ({
        slug: tier.slug,
        name: tier.name,
        priceMonthly: Math.round(Number(tier.price_monthly)),
      }));
    return paid.length > 0 ? paid : null;
  } catch {
    return null;
  }
}
