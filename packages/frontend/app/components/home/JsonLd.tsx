/**
 * JSON-LD Structured Data for the homepage (SEO + AI Search).
 *
 * Schema.org markup for:
 * - SoftwareApplication (the platform)
 * - WebSite (name/url/publisher)
 * - WebPage
 *
 * NOTE: the Organization node is emitted SITEWIDE by OrganizationJsonLd (in
 * AppShell), so it is intentionally NOT duplicated in this homepage graph —
 * two nodes sharing @id #organization on one page was an entity collision. The
 * publisher/provider @id refs below resolve to that sitewide Organization.
 */

import { fetchPaidTierOffers, type PaidTierOffer } from "@/lib/data";
import { COVERAGE_COPY } from "@/lib/data/validation-claims";
import { safeJsonLdString } from "@/lib/seo/safe-json-ld";

// Marketing blurbs keyed by tier slug; description is optional in schema.org,
// so unknown tiers simply omit it rather than inventing copy.
const OFFER_DESCRIPTIONS: Record<string, string> = {
  pro: "Unlimited lookups, full score breakdown, AI-generated reports",
  enterprise: "Everything in Pro plus team collaboration and API access",
};

function buildOffers(paidTiers: PaidTierOffer[] | null) {
  const freeOffer = {
    "@type": "Offer",
    name: "Free",
    price: "0",
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
    url: "https://www.propertyiq.app/pricing",
    description: "5 property lookups per month, basic scores, metro-level data",
  };

  // Prices come from the live pricing API (single source of truth) — never
  // hardcoded here, so schema can't drift from the /pricing page. If the
  // fetch failed we emit only the Free offer rather than stale numbers.
  const paidOffers = (paidTiers ?? []).map((tier) => ({
    "@type": "Offer",
    name: tier.name,
    price: String(tier.priceMonthly),
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
    url: "https://www.propertyiq.app/pricing",
    // P1M monthly recurring expressed via a real schema.org price spec
    // (`billingIncrement` is not a schema.org property).
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      price: String(tier.priceMonthly),
      priceCurrency: "USD",
      billingDuration: "P1M",
      unitText: "MONTH",
    },
    ...(OFFER_DESCRIPTIONS[tier.slug]
      ? { description: OFFER_DESCRIPTIONS[tier.slug] }
      : {}),
  }));

  return [freeOffer, ...paidOffers];
}

// SoftwareApplication schema - describes the platform
const softwareSchemaBase = {
  "@type": "SoftwareApplication",
  "@id": "https://www.propertyiq.app/#software",
  name: "PropertyIQ",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  featureList: [
    "AI-powered market analysis",
    "PropertyIQ Score — a market demand signal, out-of-sample validated across two decades of housing data",
    "Rental demand analysis for landlords",
    "Market quality metrics",
    "Interactive market heat maps",
    "AI-generated market reports",
    // Headline coverage MUST use the conservative COVERAGE_COPY tokens, not raw
    // live counts — exact counts churn monthly and drift against page copy.
    COVERAGE_COPY.sentence,
    "Census and economic data integration",
  ],
  audience: {
    "@type": "Audience",
    audienceType: [
      "Homebuyers",
      "Renters",
      "Real Estate Investors",
      "Real Estate Agents",
      "Real Estate Brokers",
      "Property Managers",
    ],
  },
};

// WebSite schema. The SearchAction / sitelinks-searchbox rich result was
// retired by Google (Nov 2024), so we keep a bare WebSite{name,url,publisher}
// and drop the inert potentialAction (L2).
const websiteSchema = {
  "@type": "WebSite",
  "@id": "https://www.propertyiq.app/#website",
  url: "https://www.propertyiq.app",
  name: "PropertyIQ",
  description: "AI-powered real estate market intelligence platform",
  publisher: { "@id": "https://www.propertyiq.app/#organization" },
};

// Main WebPage schema
const webPageSchema = {
  "@type": "WebPage",
  "@id": "https://www.propertyiq.app/#webpage",
  url: "https://www.propertyiq.app",
  name: "PropertyIQ - AI-Powered Real Estate Market Intelligence",
  description:
    "Make smarter real estate decisions with AI-powered market analysis for homebuyers, renters, investors, and real estate professionals.",
  isPartOf: { "@id": "https://www.propertyiq.app/#website" },
  about: { "@id": "https://www.propertyiq.app/#software" },
  provider: { "@id": "https://www.propertyiq.app/#organization" },
};

// Async server component: fetches live paid tiers (ISR-cached, 1h) so the
// schema.org offers can never drift from the /pricing page. Both homepage
// variants render <JsonLd /> with no props — the fetch lives here.
export async function JsonLd() {
  const paidTiers: PaidTierOffer[] | null = await fetchPaidTierOffers();

  const jsonLdData = {
    "@context": "https://schema.org",
    "@graph": [
      { ...softwareSchemaBase, offers: buildOffers(paidTiers) },
      websiteSchema,
      webPageSchema,
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLdString(jsonLdData) }}
    />
  );
}
