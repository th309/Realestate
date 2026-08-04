import type { Metadata } from "next";
import { fetchHeroContrast } from "@/lib/data";
import { JsonLd } from "@/app/components/home/JsonLd";
import { BeatHero } from "@/app/components/home/landing-v2/BeatHero";
import { BeatTension } from "@/app/components/home/landing-v2/BeatTension";
import { BeatFoundation } from "@/app/components/home/landing-v2/BeatFoundation";
import { BeatScore } from "@/app/components/home/landing-v2/BeatScore";
import { BeatMap } from "@/app/components/home/landing-v2/BeatMap";
import { BeatProof } from "@/app/components/home/landing-v2/BeatProof";
import { BeatPersona } from "@/app/components/home/landing-v2/BeatPersona";
import { BeatDataDepth } from "@/app/components/home/landing-v2/BeatDataDepth";
import { BeatClose } from "@/app/components/home/landing-v2/BeatClose";
import { PricingSection } from "@/app/components/home/PricingSection";
import { landingMetadata } from "@/app/components/home/landing-metadata";
import { FaqSection } from "@/app/components/seo/FaqSection";
import { HOME_FAQS } from "@/app/components/home/homeFaqs";

export const metadata: Metadata = landingMetadata;

/**
 * PropertyIQ homepage — the 8-beat narrative funnel.
 *
 * This is the only homepage. The landing A/B split that once served this
 * narrative from `/home-v2` behind a middleware rewrite is retired: the route,
 * the `piq-variant` cookie, and the `LANDING_EXPERIMENT` flag are all gone, so
 * `/` renders this directly with no rewrite and no variant assignment.
 *
 * Beats: hero → tension → foundation → score → map → proof → personas →
 * data depth → pricing → close, then the FAQ (which carries the FAQPage
 * JSON-LD, and per convention renders last).
 *
 * The page-level `<main>` lives in AppShell, so this wrapper is a plain div —
 * a nested `<main>` would be invalid.
 */
export default async function HomePage() {
  // Cached (ISR) — the hero's live momentum contrast. Null-safe: BeatHero falls
  // back to a static headline if the data is briefly unavailable.
  const contrast = await fetchHeroContrast();

  return (
    // Each beat owns an opaque surface band, so there is no page-wide gradient
    // wrapper here — the surface token is the whole background.
    <div className="bg-surface font-sans text-on-surface">
      <JsonLd />
      <BeatHero contrast={contrast} />
      <BeatTension />
      <BeatFoundation />
      <BeatScore
        coolerCbsa={contrast?.cooler.cbsa ?? "12420"}
        coolerName={contrast?.cooler.name ?? "Austin, TX"}
      />
      <BeatMap />
      <BeatProof />
      <BeatPersona />
      <BeatDataDepth />
      <PricingSection />
      <BeatClose />
      <FaqSection faqs={HOME_FAQS} />
    </div>
  );
}
