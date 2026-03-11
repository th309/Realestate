import { Target } from "lucide-react";
import { PageHeaderWithBreadcrumbs } from "@/components/navigation";
import { HeroStats } from "./components/HeroStats";
import { DollarImpactSection } from "./components/DollarImpactSection";
import { AlphaCallout } from "./components/AlphaCallout";
import { InteractiveScatter } from "./components/InteractiveScatter";
import { QuintilePerformance } from "./components/QuintilePerformance";
import { PearsonVsSpearman } from "./components/PearsonVsSpearman";
import { HeadToHead } from "./components/HeadToHead";
import { GeographyCoverage } from "./components/GeographyCoverage";
import { MethodologyFooter } from "./components/MethodologyFooter";
import { CTABanner } from "./components/CTABanner";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Forecast Accuracy — PropertyIQ Scores Beat the Competition",
  description:
    "OOS IC = 0.37, walk-forward validated across 4 windows, 924 metros, 23,000+ locations. See how PropertyIQ Scores predict real-world returns.",
  alternates: { canonical: "https://www.propertyiq.app/scores/accuracy" },
  openGraph: {
    title: "Forecast Accuracy — PropertyIQ",
    description:
      "0.37 OOS correlation. 4 walk-forward windows. Zero cherry-picking. See the proof behind PropertyIQ Scores.",
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
                description:
                  "OOS IC = 0.37, walk-forward validated across 4 windows, 924 metros, 23,000+ locations. See how PropertyIQ Scores predict real-world returns.",
                datePublished: "2026-02-10",
                dateModified: new Date().toISOString().split("T")[0],
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

      {/* 1. Hero Stats */}
      <HeroStats />

      {/* 2. Dollar Impact */}
      <DollarImpactSection />

      {/* 2b. Alpha vs Beta Callout */}
      <AlphaCallout />

      {/* 3. Interactive Scatter */}
      <InteractiveScatter />

      {/* 4. Quintile Performance */}
      <QuintilePerformance />

      {/* 5. Pearson vs Spearman Explainer */}
      <PearsonVsSpearman />

      {/* 6. Head-to-Head Comparison */}
      <HeadToHead />

      {/* 7. Geography Coverage */}
      <GeographyCoverage />

      {/* 9. Methodology */}
      <MethodologyFooter />

      {/* 10. CTA */}
      <CTABanner />
    </div>
  );
}
