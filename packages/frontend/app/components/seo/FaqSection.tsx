import { buildFaqJsonLd, type Faq } from "@/lib/seo/faq-json-ld";
import { safeJsonLdString } from "@/lib/seo/safe-json-ld";

export function FaqSection({
  faqs,
  heading = "Frequently Asked Questions",
  align = "center",
}: {
  faqs: Faq[];
  heading?: string;
  /**
   * `center` centres the block in the viewport — right for pages that are
   * themselves centred prose. `start` drops the auto-margin so the block lines
   * up with the left edge of whatever container it is placed in.
   *
   * The measure stays 4xl either way: these are prose answers, and setting
   * them to the width of a dashboard would run ~150 characters to the line.
   * The problem on a tool page is not the width, it is that a narrower box
   * centred under a wider one puts its left edge in the middle of nowhere —
   * the eye reads that as a misalignment rather than as a change of measure.
   */
  align?: "center" | "start";
}) {
  if (faqs.length < 3) return null;

  return (
    <section
      className={`max-w-4xl pb-12 ${align === "center" ? "mx-auto px-4" : ""}`}
    >
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
