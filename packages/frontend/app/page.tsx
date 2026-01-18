import {
  Navigation,
  HeroSection,
  StatsSection,
  FeaturesSection,
  PricingSection,
  CTASection,
  Footer,
} from './components/home';

/**
 * PropertyIQ Homepage
 *
 * Landing page following Material Design 3 guidelines.
 * Components are split per the 300-line rule in project_instructions.md
 */
export default function HomePage() {
  return (
    <main className="min-h-screen bg-surface text-on-surface font-sans">
      <Navigation />
      <HeroSection />
      <StatsSection />
      <FeaturesSection />
      <PricingSection />
      <CTASection />
      <Footer />
    </main>
  );
}
