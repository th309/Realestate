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
  title: "PropertyIQ — AI-Powered Real Estate Market Analysis",
  description:
    "PropertyIQ ranks 925 US metros and 33,000+ ZIP codes with AI to find housing markets that outperform. Free interactive maps, market scores, and AI-generated reports.",
  alternates: { canonical: "https://www.propertyiq.app" },
  openGraph: {
    title: "PropertyIQ — AI-Powered Real Estate Market Analysis",
    description:
      "PropertyIQ ranks 925 US metros and 33,000+ ZIP codes with AI to find housing markets that outperform. Free maps, scores, and reports.",
    url: "https://www.propertyiq.app",
    siteName: "PropertyIQ",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "PropertyIQ - AI Real Estate Intelligence",
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
