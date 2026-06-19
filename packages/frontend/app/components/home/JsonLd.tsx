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

import { V4_CLAIMS } from "@/lib/data/validation-claims";

// SoftwareApplication schema - describes the platform
const softwareSchema = {
  "@type": "SoftwareApplication",
  "@id": "https://www.propertyiq.app/#software",
  name: "PropertyIQ",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  offers: [
    {
      "@type": "Offer",
      name: "Free",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: "https://www.propertyiq.app/pricing",
      description:
        "5 property lookups per month, basic scores, metro-level data",
    },
    {
      "@type": "Offer",
      name: "Pro",
      price: "39",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: "https://www.propertyiq.app/pricing",
      // P1M monthly recurring expressed via a real schema.org price spec
      // (`billingIncrement` is not a schema.org property).
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: "39",
        priceCurrency: "USD",
        billingDuration: "P1M",
        unitText: "MONTH",
      },
      description:
        "Unlimited lookups, full score breakdown, AI-generated reports",
    },
    {
      "@type": "Offer",
      name: "Team",
      price: "99",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: "https://www.propertyiq.app/pricing",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: "99",
        priceCurrency: "USD",
        billingDuration: "P1M",
        unitText: "MONTH",
      },
      description: "Everything in Pro plus team collaboration and API access",
    },
  ],
  featureList: [
    "AI-powered market analysis",
    "PropertyIQ Score — a market demand signal, out-of-sample validated across two decades of housing data",
    "Rental demand analysis for landlords",
    "Market quality metrics",
    "Interactive market heat maps",
    "AI-generated market reports",
    `${V4_CLAIMS.metrosScored} US metros, ${V4_CLAIMS.countiesScored.toLocaleString()} counties, and ${V4_CLAIMS.zipsScored.toLocaleString()} ZIP codes`,
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

// Combined schema graph
const jsonLdData = {
  "@context": "https://schema.org",
  "@graph": [softwareSchema, websiteSchema, webPageSchema],
};

export function JsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdData) }}
    />
  );
}
