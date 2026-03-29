/**
 * JSON-LD Structured Data for SEO and AI Search
 *
 * Implements Schema.org markup for:
 * - Organization (PropertyIQ company info)
 * - SoftwareApplication (the platform)
 * - WebSite (search action)
 * - Product offerings
 */

// Organization schema - tells search engines about the company
const organizationSchema = {
  "@type": "Organization",
  "@id": "https://www.propertyiq.app/#organization",
  name: "PropertyIQ",
  url: "https://www.propertyiq.app",
  logo: {
    "@type": "ImageObject",
    url: "https://www.propertyiq.app/logo.png",
    width: 512,
    height: 512,
  },
  description:
    "PropertyIQ provides AI-powered real estate market intelligence for homebuyers, renters, investors, and real estate professionals.",
  foundingDate: "2024",
  sameAs: [
    "https://twitter.com/propertyiq",
    "https://linkedin.com/company/propertyiq",
  ],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    email: "support@propertyiq.app",
  },
};

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
      description:
        "5 property lookups per month, basic scores, metro-level data",
    },
    {
      "@type": "Offer",
      name: "Pro",
      price: "29",
      priceCurrency: "USD",
      billingIncrement: "P1M",
      description:
        "Unlimited lookups, full score breakdown, AI-generated reports",
    },
    {
      "@type": "Offer",
      name: "Team",
      price: "99",
      priceCurrency: "USD",
      billingIncrement: "P1M",
      description: "Everything in Pro plus team collaboration and API access",
    },
  ],
  featureList: [
    "AI-powered market analysis",
    "PropertyIQ Score — predicts market performance with 100% year hit rate across 746 metros",
    "Rental demand analysis for landlords",
    "Market quality metrics",
    "Interactive market heat maps",
    "AI-generated market reports",
    "925 US metros, 3,100+ counties, and 33,000+ ZIP codes",
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

// WebSite schema with search action for sitelinks
const websiteSchema = {
  "@type": "WebSite",
  "@id": "https://www.propertyiq.app/#website",
  url: "https://www.propertyiq.app",
  name: "PropertyIQ",
  description: "AI-powered real estate market intelligence platform",
  publisher: { "@id": "https://www.propertyiq.app/#organization" },
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: "https://www.propertyiq.app/map?q={search_term_string}",
    },
    "query-input": "required name=search_term_string",
  },
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
  speakable: {
    "@type": "SpeakableSpecification",
    cssSelector: ["h1", ".hero-description", ".feature-title"],
  },
};

// Combined schema graph
const jsonLdData = {
  "@context": "https://schema.org",
  "@graph": [organizationSchema, softwareSchema, websiteSchema, webPageSchema],
};

export function JsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdData) }}
    />
  );
}
