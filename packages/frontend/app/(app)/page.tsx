import type { Metadata } from "next";
import { fetchHeroContrast } from "@/lib/data";
import { JsonLd } from "@/app/components/home/JsonLd";
import { BeatHero } from "@/app/components/home/landing-v2/BeatHero";
import { Constellation } from "@/app/components/home/landing-v2/Constellation";
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
 * Everything below the hero sits inside ONE continuous indigo fade, brand
 * indigo at the top running to pale indigo at the foot of the page. That means
 * those sections take `surface="none"`: an opaque band would chop the fade
 * into stripes. Separation comes from their cards, which are opaque, and from
 * the shared rhythm.
 *
 * The top of the fade is dark enough that copy sitting directly on it must be
 * light — see PAGE_FADE_TOP_SECTIONS below. Anything sitting on a card is
 * unaffected, since the card supplies its own surface.
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
      {/*
        The fade. Its shoulder is early (see --md-page-fade-mid): only
        BeatPersona sits on the saturated part, which is why it is the one
        section toned `onDark`. Everything below it is pale enough for the
        normal on-surface tokens. If a section is added or reordered here,
        re-run the contrast sweep — which section straddles the dark part
        depends on the heights above it, not on its position alone.

        `relative` and `overflow-hidden` are for the Constellation, which is
        absolutely positioned to this band.
      */}
      <div className="relative overflow-hidden bg-[linear-gradient(to_bottom,var(--color-page-fade-from)_0%,var(--color-page-fade-mid)_14%,var(--color-page-fade-to)_100%)]">
        <Constellation />
        <div className="relative">
          <BeatPersona />
          <StepsSection />
          <PlatformFeatures />
          <BeatProof />
          <Testimonials />
          <PricingSection />
          <BeatClose />
          <BlogPreview />
          <div className="pt-12">
            <FaqSection faqs={HOME_FAQS} />
          </div>
        </div>
      </div>
    </div>
  );
}
