/**
 * Competitor comparison data for SEO comparison pages.
 *
 * Each entry defines a slug-based comparison with feature rows,
 * pricing rows, and a summary paragraph.
 *
 * Raw data lives in ./comparisons/comparison-data.ts to stay within
 * file size limits (CLAUDE.md Section 1.3).
 */

import {
  MASHVISOR_COMPARISON,
  NEIGHBORHOODSCOUT_COMPARISON,
  REVENTURE_COMPARISON,
} from "./comparisons/comparison-data";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ComparisonWinner = "propertyiq" | "competitor" | "tie";

export interface FeatureRow {
  feature: string;
  propertyiq: string;
  competitor: string;
  winner: ComparisonWinner;
}

export interface PricingRow {
  tier: string;
  propertyiq: string;
  competitor: string;
}

export interface ComparisonFaq {
  question: string;
  answer: string;
}

export interface ComparisonData {
  slug: string;
  competitorName: string;
  competitorUrl: string;
  title: string;
  description: string;
  features: FeatureRow[];
  pricing: PricingRow[];
  summary: string;
  faqs: ComparisonFaq[];
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

export const COMPARISONS: ComparisonData[] = [
  REVENTURE_COMPARISON,
  MASHVISOR_COMPARISON,
  NEIGHBORHOODSCOUT_COMPARISON,
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Look up a comparison by its URL slug. Returns undefined if not found. */
export function getComparison(slug: string): ComparisonData | undefined {
  return COMPARISONS.find((c) => c.slug === slug);
}

/**
 * Inject live PropertyIQ prices into comparison data, replacing hardcoded values.
 * Call this with prices fetched from the pricing API.
 */
export function withLivePricing(
  comparison: ComparisonData,
  prices: { proMonthly: string; enterpriseMonthly: string },
): ComparisonData {
  const { proMonthly, enterpriseMonthly } = prices;

  // Replace {{PRO_PRICE}} and {{ENTERPRISE_PRICE}} template variables
  const interpolate = (text: string) =>
    text
      .replace(/\{\{PRO_PRICE\}\}/g, proMonthly)
      .replace(/\{\{ENTERPRISE_PRICE\}\}/g, enterpriseMonthly);

  const pricing = comparison.pricing.map((row) => ({
    ...row,
    propertyiq: interpolate(row.propertyiq),
  }));

  const summary = interpolate(comparison.summary);

  const faqs = comparison.faqs.map((faq) => ({
    ...faq,
    answer: interpolate(faq.answer),
  }));

  return { ...comparison, pricing, summary, faqs };
}
