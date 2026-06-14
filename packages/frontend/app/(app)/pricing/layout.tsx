import type { Metadata } from "next";
import { WebPageJsonLd } from "@/app/components/seo/WebPageJsonLd";

export const metadata: Metadata = {
  title: "Plans & Pricing — Real Estate Analytics",
  description:
    "Compare PropertyIQ plans: Free, Pro, and Enterprise. AI-powered market analysis, scores, reports, and maps for real estate professionals.",
  alternates: { canonical: "https://www.propertyiq.app/pricing" },
  openGraph: {
    title: "Plans & Pricing — Real Estate Analytics | PropertyIQ",
    description:
      "Compare PropertyIQ plans: Free, Pro, and Enterprise. AI-powered market analysis, scores, reports, and maps.",
    url: "https://www.propertyiq.app/pricing",
    siteName: "PropertyIQ",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "PropertyIQ Pricing Plans",
      },
    ],
  },
};

const pricingJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      url: "https://www.propertyiq.app/pricing",
      name: "Pricing — PropertyIQ",
      description:
        "Compare PropertyIQ plans: Free, Pro, and Enterprise tiers for AI-powered real estate market analysis.",
    },
    {
      "@type": "SoftwareApplication",
      name: "PropertyIQ",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "AI-powered real estate market intelligence platform with market scores, reports, and interactive maps.",
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
          price: "39",
          priceCurrency: "USD",
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            price: "39",
            priceCurrency: "USD",
            billingDuration: "P1M",
          },
          description:
            "Unlimited lookups, full score breakdown, AI-generated reports, ZIP-level data",
        },
        {
          "@type": "Offer",
          name: "Team",
          price: "99",
          priceCurrency: "USD",
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            price: "99",
            priceCurrency: "USD",
            billingDuration: "P1M",
          },
          description:
            "Everything in Pro plus team collaboration, API access, and custom reports",
        },
      ],
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: "https://www.propertyiq.app",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Pricing",
          item: "https://www.propertyiq.app/pricing",
        },
      ],
    },
  ],
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingJsonLd) }}
      />

      {/* Server-rendered pricing summary for crawlers */}
      <noscript>
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "2rem" }}>
          <h1>Pricing</h1>
          <p>
            Compare PropertyIQ plans for AI-powered real estate market analysis,
            scores, reports, and maps.
          </p>
          <h2>Free — $0/month</h2>
          <p>
            5 property lookups per month, basic market scores, metro-level data
            access, and limited market comparisons.
          </p>
          <h2>Pro — $39/month</h2>
          <p>
            Unlimited lookups, full score breakdowns with component analysis,
            AI-generated market reports, ZIP-level data, and priority support.
          </p>
          <h2>Team — $99/month</h2>
          <p>
            Everything in Pro plus team collaboration, API access, custom
            reports, and dedicated account management.
          </p>
        </div>
      </noscript>

      {children}
    </>
  );
}
