import type { Metadata } from "next";
import { fetchHeroContrast } from "@/lib/data";
import { JsonLd } from "@/app/components/home/JsonLd";
import { VariantStamp } from "@/app/components/home/landing-v2/VariantStamp";
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

/**
 * Variant B homepage — the 8-beat narrative funnel.
 *
 * Served at `/` via a middleware rewrite when the visitor is assigned variant B
 * (see middleware.ts + lib/experiments/landing-variant.ts). Because the visible
 * URL stays `/`, this route's metadata MUST be the canonical, indexable homepage
 * metadata identical to control A — never a static `noindex`, or promoting the
 * flag to `on` would deindex the live homepage. Preview/draft hits are made
 * noindex by middleware via the `X-Robots-Tag` response header instead.
 *
 * NOTE: this is the Phase-0 skeleton. Phase 3 (Task 3.2) swaps the placeholder
 * metadata below for the shared object extracted from the A page so SEO carries
 * over verbatim, and Phase 2 mounts the 8 beats inside <main>.
 */
export const metadata: Metadata = {
  title: "PropertyIQ — Real Estate Market Data & Investment Scores by ZIP Code",
  alternates: { canonical: "https://www.propertyiq.app" },
};

export default async function HomeV2Page() {
  // Cached (ISR) — the hero's live momentum contrast. Null-safe: BeatHero falls
  // back to a static headline if the data is briefly unavailable.
  const contrast = await fetchHeroContrast();

  return (
    <div className="text-on-surface font-sans bg-gradient-to-b from-[#1A237E] via-[#3949AB] via-30% to-[#E8EAF6]">
      <JsonLd />
      <VariantStamp variant="B" />
      <main id="landing-v2">
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
      </main>
    </div>
  );
}
