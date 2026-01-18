/**
 * JSON-LD Structured Data for SEO and AI Search
 *
 * Implements Schema.org markup for:
 * - Organization (PropertyIQ company info)
 * - SoftwareApplication (the platform)
 * - WebSite (search action)
 * - FAQPage (common questions)
 * - Product offerings
 */

// Organization schema - tells search engines about the company
const organizationSchema = {
  "@type": "Organization",
  "@id": "https://propertyiq.com/#organization",
  name: "PropertyIQ",
  url: "https://propertyiq.com",
  logo: {
    "@type": "ImageObject",
    url: "https://propertyiq.com/logo.png",
    width: 512,
    height: 512
  },
  description: "PropertyIQ provides AI-powered real estate market intelligence for homebuyers, renters, investors, and real estate professionals.",
  foundingDate: "2024",
  sameAs: [
    "https://twitter.com/propertyiq",
    "https://linkedin.com/company/propertyiq"
  ],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    email: "support@propertyiq.com"
  }
};

// SoftwareApplication schema - describes the platform
const softwareSchema = {
  "@type": "SoftwareApplication",
  "@id": "https://propertyiq.com/#software",
  name: "PropertyIQ",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  offers: [
    {
      "@type": "Offer",
      name: "Free",
      price: "0",
      priceCurrency: "USD",
      description: "5 property lookups per month, basic scores, metro-level data"
    },
    {
      "@type": "Offer",
      name: "Pro",
      price: "29",
      priceCurrency: "USD",
      billingIncrement: "P1M",
      description: "Unlimited lookups, full score breakdown, AI-generated reports"
    },
    {
      "@type": "Offer",
      name: "Team",
      price: "99",
      priceCurrency: "USD",
      billingIncrement: "P1M",
      description: "Everything in Pro plus team collaboration and API access"
    }
  ],
  featureList: [
    "AI-powered market analysis",
    "HomeReady Score for homebuyers",
    "InvestorEdge Score for real estate investors",
    "Rental demand analysis for landlords",
    "Neighborhood quality metrics",
    "Interactive market heat maps",
    "AI-generated market reports",
    "384 US metro area coverage",
    "Census and economic data integration"
  ],
  audience: {
    "@type": "Audience",
    audienceType: [
      "Homebuyers",
      "Renters",
      "Real Estate Investors",
      "Real Estate Agents",
      "Real Estate Brokers",
      "Property Managers"
    ]
  }
};

// WebSite schema with search action for sitelinks
const websiteSchema = {
  "@type": "WebSite",
  "@id": "https://propertyiq.com/#website",
  url: "https://propertyiq.com",
  name: "PropertyIQ",
  description: "AI-powered real estate market intelligence platform",
  publisher: { "@id": "https://propertyiq.com/#organization" },
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: "https://propertyiq.com/search?q={search_term_string}"
    },
    "query-input": "required name=search_term_string"
  }
};

// FAQ schema - common questions for featured snippets
const faqSchema = {
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is PropertyIQ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "PropertyIQ is an AI-powered real estate market intelligence platform that helps homebuyers, renters, real estate investors, and agents make data-driven property decisions. It provides proprietary scores like HomeReady Score and InvestorEdge Score, interactive market heat maps, and AI-generated reports covering 384 US metro areas."
      }
    },
    {
      "@type": "Question",
      name: "How does PropertyIQ help homebuyers?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "PropertyIQ helps homebuyers with the HomeReady Score that evaluates properties based on neighborhood quality, school ratings, walkability, price appreciation potential, and affordability. It provides 3-year price trend forecasts and compares homes across key livability metrics."
      }
    },
    {
      "@type": "Question",
      name: "What real estate investor tools does PropertyIQ offer?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "For real estate investors, PropertyIQ provides the InvestorEdge Score combining cap rate analysis, cash flow projections, rental demand indicators, appreciation forecasts, and market cycle positioning. It helps identify high-ROI investment opportunities others miss."
      }
    },
    {
      "@type": "Question",
      name: "How can real estate agents use PropertyIQ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Real estate agents and brokers use PropertyIQ to generate professional AI-powered market reports for clients, access comprehensive neighborhood data, and provide data-backed recommendations. The Team plan includes API access for CRM integration."
      }
    },
    {
      "@type": "Question",
      name: "What data sources does PropertyIQ use?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "PropertyIQ aggregates data from multiple authoritative sources including US Census Bureau demographics, Bureau of Labor Statistics employment data, Zillow home values and rental estimates, and FRED economic indicators. All data is normalized and updated regularly."
      }
    }
  ]
};

// Main WebPage schema
const webPageSchema = {
  "@type": "WebPage",
  "@id": "https://propertyiq.com/#webpage",
  url: "https://propertyiq.com",
  name: "PropertyIQ - AI-Powered Real Estate Market Intelligence",
  description: "Make smarter real estate decisions with AI-powered market analysis for homebuyers, renters, investors, and real estate professionals.",
  isPartOf: { "@id": "https://propertyiq.com/#website" },
  about: { "@id": "https://propertyiq.com/#software" },
  provider: { "@id": "https://propertyiq.com/#organization" },
  speakable: {
    "@type": "SpeakableSpecification",
    cssSelector: ["h1", ".hero-description", ".feature-title"]
  }
};

// Combined schema graph
const jsonLdData = {
  "@context": "https://schema.org",
  "@graph": [
    organizationSchema,
    softwareSchema,
    websiteSchema,
    faqSchema,
    webPageSchema
  ]
};

export function JsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdData) }}
    />
  );
}
