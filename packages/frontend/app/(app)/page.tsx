import type { Metadata } from "next";
import { fetchHeroContrast } from "@/lib/data";
import { JsonLd } from "@/app/components/home/JsonLd";
import { BeatHero } from "@/app/components/home/landing-v2/BeatHero";
import { BeatPersona } from "@/app/components/home/landing-v2/BeatPersona";
import { StepsSection } from "@/app/components/home/landing-v2/StepsSection";
import { PlatformFeatures } from "@/app/components/home/landing-v2/PlatformFeatures";
import { Testimonials } from "@/app/components/home/landing-v2/Testimonials";
import { BeatClose } from "@/app/components/home/landing-v2/BeatClose";
import { BlogPreview } from "@/app/components/home/landing-v2/BlogPreview";
import { PricingSection } from "@/app/components/home/PricingSection";
import { landingMetadata } from "@/app/components/home/landing-metadata";
import { FaqSection } from "@/app/components/seo/FaqSection";
import { HOME_FAQS } from "@/app/components/home/homeFaqs";

export const metadata: Metadata = landingMetadata;

/**
 * PropertyIQ homepage.
 *
 * The section order is the approved mockup's, which is deliberately the
 * conventional one — hero → persona → three steps → platform features →
 * testimonials → final CTA → blog. It replaces the nine-beat narrative essay
 * this page used to be: that version asked a visitor to read an argument
 * before it showed them what the product was.
 *
 * Pricing and the FAQ are ours, not the mockup's — that artifact was scoped to
 * the homepage and blog. Pricing sits before the close because the close is
 * the ask; the FAQ renders last because it carries the FAQPage JSON-LD.
 *
 * Bands alternate surface a/b so each section reads as a section. The hero and
 * the close share the pale gradient, which brackets the page.
 *
 * The page-level `<main>` lives in AppShell, so this wrapper is a plain div —
 * a nested `<main>` would be invalid.
 */
export default async function HomePage() {
  // Cached (ISR) — the hero's live scores. Null-safe: BeatHero falls back to a
  // static headline and drops the monitor if the batch is briefly unavailable.
  const contrast = await fetchHeroContrast();

  return (
    <div className="bg-surface font-sans text-on-surface">
      <JsonLd />
      <BeatHero contrast={contrast} />
      <BeatPersona />
      <StepsSection />
      <PlatformFeatures />
      <Testimonials />
      <PricingSection />
      <BeatClose />
      <BlogPreview />
      <FaqSection faqs={HOME_FAQS} />
    </div>
  );
}
