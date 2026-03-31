/**
 * Shared feature bullet builder for pricing displays.
 *
 * Both the homepage PricingSection and the dedicated /pricing page
 * use this to ensure feature lists always match.
 */

import type { PricingFeature } from "@/lib/data/fetchers/pricing";

export function buildFeatureBullets(
  slug: string,
  features: PricingFeature[],
): string[] {
  const has = (s: string) => features.some((f) => f.slug === s);
  const catCount = (cat: string) =>
    features.filter((f) => f.category === cat).length;
  const bullets: string[] = [];

  if (slug === "free") {
    bullets.push("Interactive market maps");
    bullets.push("National & state-level data");
    bullets.push(`${catCount("metrics")}+ real estate metrics`);
    bullets.push("Historical trends & charts");
    const reportLimit = features.find(
      (f) => f.slug === "preview_reports_limit",
    );
    if (
      reportLimit &&
      typeof reportLimit.value === "number" &&
      reportLimit.value > 0
    ) {
      bullets.push(`${reportLimit.value} preview reports`);
    }
  } else if (slug === "pro") {
    bullets.push("Everything in Free, plus:");
    if (has("geo_county") || has("geo_zip"))
      bullets.push("Metro, county, and ZIP code data");
    if (
      has("metric_homeready_score") ||
      has("metric_investoredge_score") ||
      has("metric_market_health_score")
    )
      bullets.push("PropertyIQ composite scores");
    if (has("feature_ai_insights")) bullets.push("AI market analysis");
    if (has("feature_reports")) {
      const reportLimitFeature = features.find(
        (f) => f.slug === "feature_reports_monthly",
      );
      const reportLimit =
        reportLimitFeature && typeof reportLimitFeature.value === "number"
          ? reportLimitFeature.value
          : null;
      if (reportLimit && reportLimit > 0 && reportLimit < 1000) {
        bullets.push(`${reportLimit} AI reports/month`);
      } else {
        bullets.push("Unlimited AI reports");
      }
    }
    if (has("feature_export_csv")) bullets.push("CSV data export");
    if (has("feature_analytics_assistant")) bullets.push("Analytics assistant");
    if (has("feature_api_access") || has("feature_mcp_access"))
      bullets.push("ChatGPT & Claude integration");
  } else if (slug === "enterprise") {
    bullets.push("Everything in Pro, plus:");
    if (has("feature_embed_builder")) bullets.push("Embeddable objects");
    if (has("feature_embeddable_widgets")) bullets.push("Widgets");
    bullets.push("Team & brokerage features");
    bullets.push("Priority support");
  } else {
    bullets.push(`${features.length} features included`);
  }

  return bullets;
}

/** Static fallback bullets when API data hasn't loaded yet. */
export const FALLBACK_BULLETS: Record<string, string[]> = {
  free: [
    "Interactive market maps",
    "National & state-level data",
    "Historical trends & charts",
    "Preview reports",
  ],
  pro: [
    "Everything in Free, plus:",
    "Metro, county, and ZIP code data",
    "PropertyIQ composite scores",
    "AI market analysis",
    "Unlimited AI reports",
    "CSV data export",
    "ChatGPT & Claude integration",
  ],
  enterprise: [
    "Everything in Pro, plus:",
    "Embeddable objects",
    "Widgets",
    "Team & brokerage features",
    "Priority support",
  ],
};
