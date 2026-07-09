import { Target } from "lucide-react";
import { PageHeaderWithBreadcrumbs } from "@/components/navigation";
import { AccuracyPageShell } from "./components/AccuracyPageShell";
import { HeadToHead } from "./components/HeadToHead";
import { CTABanner } from "./components/CTABanner";
import type { Metadata } from "next";
import { COVERAGE_COPY } from "@/lib/data/validation-claims";

export const metadata: Metadata = {
  title: "Forecast Accuracy — PropertyIQ Scores Beat the Competition",
  description: `OOS IC = 0.27, validated across ${COVERAGE_COPY.metros} metros and more than two decades, positive in every year. See how PropertyIQ Scores predict real-world returns.`,
  alternates: { canonical: "https://www.propertyiq.app/scores/accuracy" },
  openGraph: {
    title: "Forecast Accuracy — PropertyIQ",
    description:
      "0.27 OOS correlation. Positive in every validated year. Zero cherry-picking. See the proof behind PropertyIQ Scores.",
    url: "https://www.propertyiq.app/scores/accuracy",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
};

export default function AccuracyPage() {
  return (
    <div className="mt-12 space-y-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Article",
                headline:
                  "Forecast Accuracy — PropertyIQ Scores Beat the Competition",
                description: `OOS IC = 0.27, validated across ${COVERAGE_COPY.metros} metros and more than two decades, positive in every year. See how PropertyIQ Scores predict real-world returns.`,
                datePublished: "2026-02-10",
                dateModified: "2026-06-26",
                author: {
                  "@type": "Organization",
                  name: "PropertyIQ",
                  url: "https://www.propertyiq.app",
                },
                publisher: {
                  "@id": "https://www.propertyiq.app/#organization",
                },
                mainEntityOfPage: "https://www.propertyiq.app/scores/accuracy",
              },
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  {
                    "@type": "ListItem",
                    position: 1,
                    name: "Home",
                    item: "https://www.propertyiq.app",
                  },
                  {
                    "@type": "ListItem",
                    position: 2,
                    name: "Scores",
                    item: "https://www.propertyiq.app/scores",
                  },
                  {
                    "@type": "ListItem",
                    position: 3,
                    name: "Accuracy",
                    item: "https://www.propertyiq.app/scores/accuracy",
                  },
                ],
              },
            ],
          }),
        }}
      />
      {/* Breadcrumbs */}
      <section>
        <PageHeaderWithBreadcrumbs
          breadcrumbs={[
            { label: "Scores", href: "/scores" },
            { label: "Forecast Accuracy" },
          ]}
          title="Forecast Accuracy"
          description="How well do PropertyIQ Scores predict real-world market returns?"
          icon={<Target className="w-5 h-5" />}
        />
      </section>

      {/* Interactive shell — owns horizon toggle state */}
      <AccuracyPageShell>
        {/* Async server components rendered outside client boundary */}
        <HeadToHead />
        <CTABanner />
      </AccuracyPageShell>
    </div>
  );
}
