"use client";

import { useInsight } from "@/lib/data";
import { parseMarkdownSections } from "@/lib/insights/parse-markdown-sections";

interface ForecastNarrativeSectionProps {
  metroName: string;
  cbsaCode: string;
  /** Server-fetched cached narrative (cachedOnly=1); null when not yet generated. */
  initialInsight?: { content: string; generated_at: string } | null;
}

/**
 * AI market_forecast narrative, rendered from ## markdown sections.
 * Server insight is preferred (SSR/ISR, cache-only); when absent, a client
 * fetch triggers generation on first human visit and fills the cache.
 * Returns null when no content exists — the page renders fully without it.
 */
export function ForecastNarrativeSection({
  metroName,
  cbsaCode,
  initialInsight,
}: ForecastNarrativeSectionProps) {
  const hasServerInsight = !!initialInsight?.content;

  const { insight: clientInsight } = useInsight(
    hasServerInsight ? null : "metro",
    hasServerInsight ? null : cbsaCode,
    "market_forecast",
  );

  const content = initialInsight?.content ?? clientInsight;
  if (!content) return null;

  const sections = parseMarkdownSections(content);
  return (
    <section
      className="max-w-4xl mx-auto px-4 py-8"
      aria-label={`${metroName} forecast analysis`}
    >
      {sections.map((s) => (
        <div key={s.title} className="mb-8">
          <h2 className="text-xl font-medium text-on-surface mb-3">
            {s.title}
          </h2>
          {s.body.split(/\n{2,}/).map((paragraph, i) => (
            <p
              key={i}
              className="text-sm text-on-surface-variant leading-relaxed mt-3"
            >
              {paragraph}
            </p>
          ))}
        </div>
      ))}
    </section>
  );
}
