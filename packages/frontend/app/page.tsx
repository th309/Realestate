import type { Metadata } from 'next';
import {
  HeroSection,
  StatsSection,
  FeaturesSection,
  PricingSection,
  CTASection,
  Footer,
  JsonLd,
} from './components/home';

// Page-specific SEO metadata
export const metadata: Metadata = {
  title: "PropertyIQ - AI Real Estate Market Intelligence for Homebuyers, Investors & Agents",
  description: "PropertyIQ provides AI-powered real estate analytics for homebuyers finding their perfect home, renters comparing neighborhoods, investors maximizing ROI, and agents serving clients with data-driven insights. Covers 384 US metro areas.",
  alternates: {
    canonical: "https://propertyiq.com"
  }
};

/**
 * PropertyIQ Homepage
 *
 * Landing page optimized for:
 * - Homebuyers & renters seeking neighborhood insights
 * - Real estate investors analyzing ROI opportunities
 * - Real estate agents & brokers needing market data
 * - AI search engines via JSON-LD structured data
 *
 * Note: Header/Navigation is provided by the root layout
 */
export default function HomePage() {
  return (
    <>
      <JsonLd />
      <div className="bg-surface text-on-surface font-sans">
        <HeroSection />
        <StatsSection />
        <FeaturesSection />
        <PricingSection />
        <CTASection />
        <Footer />
      </div>
    </>
  );
}
