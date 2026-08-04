import type { Metadata } from "next";
import { fetchHeroContrast } from "@/lib/data";
import { JsonLd } from "@/app/components/home/JsonLd";
import { BeatHero } from "@/app/components/home/landing-v2/BeatHero";
import { BeatPersona } from "@/app/components/home/landing-v2/BeatPersona";
import { StepsSection } from "@/app/components/home/landing-v2/StepsSection";
import { PlatformFeatures } from "@/app/components/home/landing-v2/PlatformFeatures";
import { BeatProof } from "@/app/components/home/landing-v2/BeatProof";
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
 * BeatProof is kept from that essay and sits directly after the feature grid,
 * because the grid's "Validated backtest" card makes a claim and this is the
 * evidence for it — claim, then proof, then social proof. It is the only beat
 * carrying material the mockup compresses to a single line.
 *
 * Pricing and the FAQ are ours, not the mockup's — that artifact was scoped to
 * the homepage and blog. Pricing sits before the close because the close is
 * the ask; the FAQ renders last because it carries the FAQPage JSON-LD.
 *
 * Bands strictly alternate b/a so no two adjacent sections share a surface;
 * inserting a section here means re-checking the whole run, not just its
 * neighbours. Only the hero takes the pale wash — everything below it stays on
 * the faded-indigo surfaces the rest of the site uses.
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
      <BeatProof />
      <Testimonials />
      <PricingSection />
      <BeatClose />
      <BlogPreview />
      {/* FaqSection is a shared SEO component with no surface of its own, so
          the band is applied here rather than by giving every consumer of it a
          prop it does not need. */}
      <div className="bg-surface-container-low pt-12">
        <FaqSection faqs={HOME_FAQS} />
      </div>
    </div>
  );
}
