import { buildFaqJsonLd, type Faq } from "@/lib/seo/faq-json-ld";
import { safeJsonLdString } from "@/lib/seo/safe-json-ld";

export function FaqSection({
  faqs,
  heading = "Frequently Asked Questions",
}: {
  faqs: Faq[];
  heading?: string;
}) {
  if (faqs.length < 3) return null;

  return (
    <section className="max-w-4xl mx-auto px-4 pb-12">
      <h2 className="text-xl font-medium text-on-surface mb-6">{heading}</h2>
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLdString(buildFaqJsonLd(faqs)),
        }}
      />
    </section>
  );
}
