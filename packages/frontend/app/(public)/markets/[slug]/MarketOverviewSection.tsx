"use client";

/**
 * AI-generated market overview section for metro landing pages.
 *
 * Fetches the `market_overview` insight via useInsight and renders
 * structured markdown content (## headers) as styled HTML sections.
 * Includes Article JSON-LD for SEO.
 */

import { useInsight } from "@/lib/data";
import { COVERAGE_COPY } from "@/lib/data/validation-claims";

interface MarketOverviewSectionProps {
  metroName: string;
  cbsaCode: string;
  /**
   * Server-rendered (cached) narrative. When present, we render from it and
   * disable the client fetch entirely — so ISR pages ship the narrative + its
   * Article JSON-LD in the initial HTML, and never trigger a live AI generation.
   * When absent, the client fetches as before (may generate for real visitors).
   */
  initialInsight?: { content: string; generated_at: string } | null;
}

/**
 * Parse markdown-style ## headers into structured HTML sections.
 * Splits content on `## ` lines and renders each as a titled section.
 */
function parseMarkdownSections(
  content: string,
): { title: string; body: string }[] {
  const sections: { title: string; body: string }[] = [];
  const parts = content.split(/^## /m).filter(Boolean);

  for (const part of parts) {
    const newlineIndex = part.indexOf("\n");
    if (newlineIndex === -1) {
      sections.push({ title: part.trim(), body: "" });
    } else {
      const title = part.slice(0, newlineIndex).trim();
      const body = part.slice(newlineIndex + 1).trim();
      sections.push({ title, body });
    }
  }

  return sections;
}

/**
 * Cold-cache fallback: shown when no cached narrative exists yet and the live
 * AI analysis hasn't loaded. Renders a real, crawler-visible paragraph built
 * only from known-true facts (the geography name + PropertyIQ's methodology and
 * coverage) so a non-JS crawler never sees a bare shimmer. It is explicitly a
 * stand-in — it does not claim to be the full AI narrative — with a subtle
 * shimmer beneath signalling the detailed analysis is on its way.
 */
function MarketOverviewFallback({ metroName }: { metroName: string }) {
  return (
    <section className="mb-10">
      <div className="bg-surface-container-low rounded-xl p-6">
        <h2 className="text-xl font-semibold text-on-surface mb-4">
          {metroName} Market Analysis
        </h2>
        <p className="text-body text-on-surface-variant leading-relaxed">
          PropertyIQ tracks the {metroName} housing market with its PropertyIQ
          Score — a demand signal built from Zillow home-value momentum and
          Realtor.com listing activity, part of coverage spanning{" "}
          {COVERAGE_COPY.metros} U.S. metros. A detailed, AI-generated analysis
          of this market is being prepared.
        </p>
        <div className="mt-4 space-y-3 animate-pulse" aria-hidden="true">
          <div className="h-4 w-5/6 bg-surface-container-high rounded" />
          <div className="h-4 w-4/6 bg-surface-container-high rounded" />
        </div>
      </div>
    </section>
  );
}

export function MarketOverviewSection({
  metroName,
  cbsaCode,
  initialInsight,
}: MarketOverviewSectionProps) {
  const hasServerInsight = !!initialInsight?.content;

  // Disable the client fetch when a server narrative is present (null geoLevel
  // => useInsight's `enabled` is false), so a page that already has content
  // never kicks off a live generation.
  const {
    insight: clientInsight,
    generatedAt: clientGeneratedAt,
    error,
  } = useInsight(
    hasServerInsight ? null : "metro",
    hasServerInsight ? null : cbsaCode,
    "market_overview",
  );

  const insight = hasServerInsight ? initialInsight!.content : clientInsight;
  const generatedAt = hasServerInsight
    ? initialInsight!.generated_at
    : clientGeneratedAt;

  // A failed live fetch hides the section (unchanged). Otherwise, whenever there
  // is no narrative yet — cold-cache SSR or the initial client render before the
  // live fetch settles — render the crawler-visible fallback instead of a bare
  // shimmer, so the server HTML always carries real text.
  if (!hasServerInsight && error) return null;
  if (!insight) return <MarketOverviewFallback metroName={metroName} />;

  const sections = parseMarkdownSections(insight);

  return (
    <section className="mb-10">
      <div className="bg-surface-container-low rounded-xl p-6">
        <h2 className="text-xl font-semibold text-on-surface mb-4">
          {metroName} Market Analysis
        </h2>

        {sections.map((section) => (
          <div key={section.title} className="mb-6 last:mb-0">
            <h3 className="text-lg font-medium text-on-surface mb-2">
              {section.title}
            </h3>
            {section.body.split("\n\n").map((paragraph, index) => (
              <p
                key={index}
                className="text-body text-on-surface-variant leading-relaxed mb-3 last:mb-0"
              >
                {paragraph}
              </p>
            ))}
          </div>
        ))}

        {generatedAt && (
          <p className="text-xs text-on-surface-variant/60 mt-4 pt-3 border-t border-outline-variant">
            AI-generated analysis based on current market data. Last updated{" "}
            {new Date(generatedAt).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
            .
          </p>
        )}
      </div>

      {/* Article JSON-LD for SEO */}
      {generatedAt && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Article",
              headline: `${metroName} Real Estate Market Analysis`,
              datePublished: generatedAt,
              image: `https://www.propertyiq.app/api/og?title=${encodeURIComponent(metroName)}`,
              author: {
                "@type": "Organization",
                name: "PropertyIQ",
              },
              publisher: {
                "@type": "Organization",
                name: "PropertyIQ",
              },
            }),
          }}
        />
      )}
    </section>
  );
}
