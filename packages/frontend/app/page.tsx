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
  title:
    'PropertyIQ - AI Real Estate Market Intelligence for Homebuyers, Investors & Agents',
  description:
    'PropertyIQ uses machine learning to rank 925 US metros, 3,100+ counties, and 33,000+ ZIP codes and generate AI market reports. Find markets that outperform, get personalized analysis, and invest with data—not guesswork.',
  alternates: {
    canonical: 'https://propertyiq.com',
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
