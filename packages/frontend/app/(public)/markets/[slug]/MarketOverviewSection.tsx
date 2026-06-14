"use client";

/**
 * AI-generated market overview section for metro landing pages.
 *
 * Fetches the `market_overview` insight via useInsight and renders
 * structured markdown content (## headers) as styled HTML sections.
 * Includes Article JSON-LD for SEO.
 */

import { useInsight } from "@/lib/data";

interface MarketOverviewSectionProps {
  metroName: string;
  cbsaCode: string;
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

function LoadingSkeleton() {
  return (
    <div className="bg-surface-container-low rounded-xl p-6 animate-pulse">
      <div className="h-6 w-48 bg-surface-container-high rounded mb-4" />
      <div className="space-y-3">
        <div className="h-4 w-full bg-surface-container-high rounded" />
        <div className="h-4 w-5/6 bg-surface-container-high rounded" />
        <div className="h-4 w-4/6 bg-surface-container-high rounded" />
      </div>
      <div className="h-6 w-36 bg-surface-container-high rounded mt-6 mb-4" />
      <div className="space-y-3">
        <div className="h-4 w-full bg-surface-container-high rounded" />
        <div className="h-4 w-3/4 bg-surface-container-high rounded" />
      </div>
    </div>
  );
}

export function MarketOverviewSection({
  metroName,
  cbsaCode,
}: MarketOverviewSectionProps) {
  const { insight, generatedAt, loading, error } = useInsight(
    "metro",
    cbsaCode,
    "market_overview",
  );

  if (loading) return <LoadingSkeleton />;
  if (error || !insight) return null;

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
