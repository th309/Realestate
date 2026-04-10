import type { Metadata } from "next";
import {
  BrandBanner,
  HeroSection,
  EmailCaptureBar,
  ProblemSection,
  StatsSection,
  MapShowcase,
  ValuePropsSection,
  AlphaCallout,
  GraphsShowcase,
  AIIntegrationsSection,
  UseCasesSection,
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
 * Structure follows CMO-defined landing page order:
 * 1. Hero — CMO headline + subhead + CTAs + trust signals
 * 2. Social Proof — market coverage stats (immediately after hero)
 * 3. The Problem — why blind investing fails
 * 4. The Score — what PropertyIQ measures and why it matters (value props + alpha callout)
 * 5. Map — map showcase
 * 6. Data depth — graphs, AI integrations
 * 7. Use Cases — investor, agent, syndicator personas
 * 8. Pricing — Free, Pro, Enterprise tiers
 * 9. Final CTA + Footer
 */
export default function HomePage() {
  return (
    <>
      <JsonLd />
      <div className="text-on-surface font-sans bg-gradient-to-b from-[#1A237E] via-[#3949AB] via-30% to-[#E8EAF6]">
        <BrandBanner />
        <HeroSection />
        <EmailCaptureBar />
        <StatsSection />
        <ProblemSection />
        <ValuePropsSection />
        <AlphaCallout />
        <MapShowcase />
        <GraphsShowcase />
        <AIIntegrationsSection />
        <UseCasesSection />
        <PricingSection />
        <CTASection />
        <Footer />
      </div>
    </>
  );
}
