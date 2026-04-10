import type { Metadata } from "next";
import {
  BrandBanner,
  HeroSection,
  ScoreTeaser,
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
  StickyScoreBar,
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

const STICKY_SCORES = [
  { name: "Rochester NY", score: 99 },
  { name: "Buffalo NY", score: 98 },
  { name: "Miami FL", score: 13 },
];

/**
 * PropertyIQ Homepage
 *
 * Structure follows CMO-defined landing page order:
 * 1. Hero — headline + CTAs pointing to /map and /reports/sample
 * 2. Social Proof — market coverage stats
 * 3. Live Score Teaser — top 5 / bottom 5 metros (proof before problem)
 * 4. The Problem — why blind investing fails
 * 5. The Score — value props + alpha callout
 * 6. Map — map showcase
 * 7. Data depth — graphs, AI integrations
 * 8. Use Cases — investor, agent, syndicator personas
 * 9. Pricing — Free, Pro, Enterprise tiers
 * 10. Final CTA + Footer
 * + Sticky score ticker bar (appears on scroll/after 10s)
 */
export default function HomePage() {
  return (
    <>
      <JsonLd />
      <div className="text-on-surface font-sans bg-gradient-to-b from-[#1A237E] via-[#3949AB] via-30% to-[#E8EAF6]">
        <BrandBanner />
        <HeroSection />
        <StatsSection />
        {/* @ts-expect-error Async Server Component */}
        <ScoreTeaser />
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
      <StickyScoreBar scores={STICKY_SCORES} />
    </>
  );
}
