import { trackEvent } from "@/lib/analytics/tracker";

const STORAGE_KEY = "piq_pricing_cta_variant";

export type PricingCtaVariant = "A" | "B" | "C";

export const PRICING_CTA_COPY: Record<PricingCtaVariant, string> = {
  A: "Start Free Trial",
  B: "Unlock All Markets",
  C: "Get Pro Access",
};

/**
 * Returns the assigned A/B/C variant for the pricing CTA.
 *
 * On first call per browser, assigns a variant (~33% split each), persists it to
 * localStorage, and fires `ab_test.assigned` once. Subsequent calls just read the
 * stored value. Falls back to Variant A if localStorage is unavailable.
 */
export function getPricingCtaVariant(): PricingCtaVariant {
  if (typeof window === "undefined") return "A";
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as PricingCtaVariant | null;
    if (stored === "A" || stored === "B" || stored === "C") return stored;

    const rand = Math.random();
    const variant: PricingCtaVariant = rand < 1 / 3 ? "A" : rand < 2 / 3 ? "B" : "C";
    localStorage.setItem(STORAGE_KEY, variant);
    trackEvent("ab_test.assigned", { variant, test: "pricing_cta" });
    return variant;
  } catch {
    return "A";
  }
}
