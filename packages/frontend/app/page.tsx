import type { Metadata } from 'next';
import {
  HeroSection,
  StatsSection,
  ValuePropsSection,
  AlphaCallout,
  GraphsShowcase,
  PricingSection,
  CTASection,
  Footer,
  JsonLd,
} from './components/home';

export const metadata: Metadata = {
  title: 'PropertyIQ: AI Housing Market Data & Forecasts by ZIP Code',
  description:
    'PropertyIQ ranks 925 US metros and 33,000+ ZIP codes with AI to find markets that outperform. Free interactive maps, market scores, and AI-generated reports.',
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
      <div className="bg-surface text-on-surface font-sans">
        <HeroSection />
        <StatsSection />
        <ValuePropsSection />
        <AlphaCallout />
        <GraphsShowcase />
        <PricingSection />
        <CTASection />
        <Footer />
      </div>
    </>
  );
}
