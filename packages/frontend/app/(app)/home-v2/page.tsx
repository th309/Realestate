import type { Metadata } from "next";
import { JsonLd } from "@/app/components/home/JsonLd";
import { VariantStamp } from "@/app/components/home/landing-v2/VariantStamp";

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

export default function HomeV2Page() {
  return (
    <div className="text-on-surface font-sans bg-gradient-to-b from-[#1A237E] via-[#3949AB] via-30% to-[#E8EAF6]">
      <JsonLd />
      <VariantStamp variant="B" />
      <main id="landing-v2" className="min-h-screen">
        {/* Phase 2 beats mount here, in order 1 → 8. */}
        <p className="sr-only">PropertyIQ landing (variant B)</p>
      </main>
    </div>
  );
}
