import type { Metadata } from "next";
import {
  BrandBanner,
  HeroSection,
  StatsSection,
  MapShowcase,
  ValuePropsSection,
  AlphaCallout,
  GraphsShowcase,
  AIIntegrationsSection,
  PricingSection,
  CTASection,
  Footer,
  JsonLd,
} from "./components/home";

export const metadata: Metadata = {
  title: {
    absolute:
      "PropertyIQ — Real Estate Market Data & Investment Scores by ZIP Code",
  },
  description:
    "Analyze 23,600+ real estate markets with AI-powered scores, rent data, and investment insights. Free market maps, reports & forecasts by metro, county, and ZIP code.",
  alternates: { canonical: "https://www.propertyiq.app" },
  openGraph: {
    title:
      "PropertyIQ — Real Estate Market Data & Investment Scores by ZIP Code",
    type: "website",
    description:
      "Analyze 23,600+ real estate markets with AI-powered scores, rent data, and investment insights. Free maps, reports & forecasts by metro, county, and ZIP code.",
    url: "https://www.propertyiq.app",
    siteName: "PropertyIQ",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "PropertyIQ real estate market analysis dashboard",
      },
    ],
  },
};

/**
 * PropertyIQ Homepage
 *
 * Structure follows proven SaaS landing page patterns:
 * 1. Hero — bold value prop + real product screenshot
 * 2. Stats — credibility numbers
 * 3. Value Props — 3 alternating image+text sections with real product images
 * 4. Pricing
 * 5. Final CTA
 * 6. Footer
 */
export default function HomePage() {
  return (
    <>
      <JsonLd />
      <div className="text-on-surface font-sans bg-gradient-to-b from-[#1A237E] via-[#3949AB] via-30% to-[#E8EAF6]">
        <BrandBanner />
        <HeroSection />
        <StatsSection />
        <MapShowcase />
        <ValuePropsSection />
        <AlphaCallout />
        <GraphsShowcase />
        <AIIntegrationsSection />
        <PricingSection />
        <CTASection />
        <Footer />
      </div>
    </>
  );
}
