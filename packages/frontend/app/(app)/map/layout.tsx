import type { Metadata } from "next";
import { COVERAGE_COPY } from "@/lib/data/validation-claims";
import { WebPageJsonLd } from "@/app/components/seo/WebPageJsonLd";
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
        FAQ content for this page, deliberately WITHOUT FAQPage JSON-LD. Like
        the crawler-text section above, this sits above the client map and
        gets covered by `absolute inset-0` once it hydrates, so sighted users
        never see it — that's accepted, not an oversight, for the same
        full-viewport-tool reason. Google's FAQPage rich-result guidelines
        require the marked-up Q&A to be visible on the page; since it isn't
        here, we intentionally render this as plain crawlable prose (no
        FaqSection, no schema) rather than claim structured Q&A data for
        content sighted users can't see. AI crawlers still read this text
        directly from the initial HTML regardless of the missing schema.
      */}
      <section className="w-full mx-auto max-w-3xl px-6 pb-12 text-on-surface-variant">
        <h2 className="text-lg font-medium text-on-surface mb-4">
          Frequently Asked Questions
        </h2>
        <div className="space-y-4">
          {MAP_FAQS.map((faq) => (
            <div key={faq.question}>
              <p className="text-sm font-medium text-on-surface">
                {faq.question}
              </p>
              <p className="mt-1 text-sm leading-relaxed">{faq.answer}</p>
            </div>
          ))}
        </div>
      </section>
      {children}
    </>
  );
}
