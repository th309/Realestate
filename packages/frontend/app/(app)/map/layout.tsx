import type { Metadata } from "next";
import { COVERAGE_COPY } from "@/lib/data/validation-claims";
import { WebPageJsonLd } from "@/app/components/seo/WebPageJsonLd";
import { FaqSection } from "@/app/components/seo/FaqSection";
import { MAP_FAQS } from "./map-faqs";

export const metadata: Metadata = {
  title: "Interactive Real Estate Market Heat Map — 40+ Metrics by ZIP Code",
  description: `Explore the interactive housing market heat map. Visualize home values, rent prices, inventory, and 40+ metrics across ${COVERAGE_COPY.metros} US metros, ${COVERAGE_COPY.counties} counties, and ${COVERAGE_COPY.zips} ZIP codes.`,
  alternates: { canonical: "https://www.propertyiq.app/map" },
  openGraph: {
    title: "Interactive Housing Market Map | PropertyIQ",
    description: `Visualize home values, rent prices, inventory, and 40+ metrics across ${COVERAGE_COPY.metros} US metros and ${COVERAGE_COPY.zips} ZIP codes.`,
    url: "https://www.propertyiq.app/map",
    siteName: "PropertyIQ",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "PropertyIQ Interactive Housing Map",
      },
    ],
  },
};

export default function MapLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <WebPageJsonLd
        url="https://www.propertyiq.app/map"
        name="Interactive Housing Market Map"
        description={`Visualize home values, rent prices, inventory, and 40+ metrics across ${COVERAGE_COPY.metros} US metros and ${COVERAGE_COPY.zips} ZIP codes.`}
        breadcrumbs={[
          { name: "Home", url: "https://www.propertyiq.app" },
          { name: "Map", url: "https://www.propertyiq.app/map" },
        ]}
      />
      {/*
        Server-rendered text companion for the interactive map. The map itself is
        a client-only WebGL canvas (invisible to non-JS AI crawlers), so this
        describes the tool in general terms for GPTBot/ClaudeBot/PerplexityBot.
        It sits in the initial HTML at the top of <main>; once the client map
        hydrates it renders `absolute inset-0` over <main> and covers this block,
        so it never competes with the tool for sighted users. Intentionally
        describes the tool in general — NOT the current per-user map state, which
        is genuinely client-only and unavailable at SSR time.
      */}
      <section className="w-full mx-auto max-w-3xl px-6 py-8 text-on-surface-variant">
        <h1 className="text-lg font-medium text-on-surface mb-2">
          Interactive US Housing Market Map
        </h1>
        <p className="text-sm leading-relaxed">
          Explore an interactive map of the U.S. housing market covering{" "}
          {COVERAGE_COPY.sentence}. Visualize the PropertyIQ Score, home values,
          rents, inventory, days on market, and dozens of other market-trend
          metrics — from a national overview down to the ZIP-code level. Choose
          any metric and geography level to compare markets across the country.
        </p>
      </section>
      {/*
        This FAQ sits above the client map for the same reason as the section
        above it: once the map hydrates, it renders absolute inset-0 over
        main and covers this block, so sighted users never actually see
        these questions. That's accepted here, not an oversight. The map is
        a full-viewport interactive tool, and reworking the layout so the
        FAQ stays visible alongside it is a larger UI change outside this
        task's scope. The FAQ still does its job for its intended audience:
        the JSON-LD and server-rendered text land in the initial HTML, so
        Google and AI crawlers see it even though sighted users don't.
      */}
      <FaqSection faqs={MAP_FAQS} />
      {children}
    </>
  );
}
