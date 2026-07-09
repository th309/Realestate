import type { MarketFaq } from "./build-market-faqs";

/**
 * Server-rendered FAQ block for market pages (metro / county / ZIP), with
 * FAQPage JSON-LD. Mirrors the compare-page FAQ pattern (rounded-xl bordered
 * question/answer items — h3 heading + p — with inline JSON-LD) so the two
 * surfaces stay consistent. Questions render as real <h3> headings (not bare
 * <dt>) so they enter the page's heading outline for AI/search crawlers.
 *
 * Renders nothing when fewer than 3 FAQs survive data-gating — a thin 1-2 item
 * FAQPage isn't worth the structured-data surface.
 */
export function MarketFaqSection({ faqs }: { faqs: MarketFaq[] }) {
  if (faqs.length < 3) return null;

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };

  return (
    <section className="max-w-4xl mx-auto px-4 pb-12">
      <h2 className="text-xl font-medium text-on-surface mb-6">
        Frequently Asked Questions
      </h2>
      <div className="space-y-4">
        {faqs.map((faq) => (
          <div
            key={faq.question}
            className="rounded-xl border border-outline-variant p-5"
          >
            <h3 className="text-base font-medium text-on-surface">
              {faq.question}
            </h3>
            <p className="mt-2 text-sm text-on-surface-variant leading-relaxed">
              {faq.answer}
            </p>
          </div>
        ))}
      </div>
      {/* Safe: JSON.stringify of a server-built object with no user input */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
    </section>
  );
}
